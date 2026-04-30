use anchor_lang::prelude::*;

use crate::constants::TOKEN_METADATA_PROGRAM_ID;
use crate::errors::AgioError;

/// Parse the `collection` field from Metaplex Token Metadata account data.
/// Returns (verified, collection_key) if present.
fn parse_metadata_collection(data: &[u8]) -> Option<(bool, Pubkey)> {
    let mut offset: usize = 0;

    // key: u8
    if data.len() < 1 {
        return None;
    }
    offset += 1;

    // update_authority: Pubkey (32)
    offset += 32;
    // mint: Pubkey (32)
    offset += 32;

    if data.len() < offset + 4 {
        return None;
    }

    // name: String (4 bytes len + data)
    let name_len = u32::from_le_bytes(data[offset..offset + 4].try_into().ok()?) as usize;
    offset += 4 + name_len;

    if data.len() < offset + 4 {
        return None;
    }

    // symbol: String
    let symbol_len = u32::from_le_bytes(data[offset..offset + 4].try_into().ok()?) as usize;
    offset += 4 + symbol_len;

    if data.len() < offset + 4 {
        return None;
    }

    // uri: String
    let uri_len = u32::from_le_bytes(data[offset..offset + 4].try_into().ok()?) as usize;
    offset += 4 + uri_len;

    // seller_fee_basis_points: u16
    offset += 2;

    if data.len() < offset + 1 {
        return None;
    }

    // creators: Option<Vec<Creator>>
    let has_creators = *data.get(offset)? == 1;
    offset += 1;
    if has_creators {
        if data.len() < offset + 4 {
            return None;
        }
        let creators_len = u32::from_le_bytes(data[offset..offset + 4].try_into().ok()?) as usize;
        offset += 4;
        // Each Creator = address(32) + verified(1) + share(1) = 34 bytes
        offset += creators_len * 34;
    }

    // primary_sale_happened: bool
    offset += 1;
    // is_mutable: bool
    offset += 1;

    if data.len() < offset + 1 {
        return None;
    }

    // edition_nonce: Option<u8>
    let has_edition_nonce = *data.get(offset)? == 1;
    offset += 1;
    if has_edition_nonce {
        offset += 1;
    }

    if data.len() < offset + 1 {
        return None;
    }

    // token_standard: Option<u8>
    let has_token_standard = *data.get(offset)? == 1;
    offset += 1;
    if has_token_standard {
        offset += 1;
    }

    if data.len() < offset + 1 {
        return None;
    }

    // collection: Option<Collection { verified: bool, key: Pubkey }>
    let has_collection = *data.get(offset)? == 1;
    offset += 1;
    if has_collection {
        if data.len() < offset + 1 + 32 {
            return None;
        }
        let verified = *data.get(offset)? == 1;
        offset += 1;
        let key_bytes: [u8; 32] = data[offset..offset + 32].try_into().ok()?;
        let key = Pubkey::from(key_bytes);
        Some((verified, key))
    } else {
        None
    }
}

/// Verify that the user holds an NFT from the specified collection.
///
/// remaining_accounts must contain exactly 3 accounts:
///   [0] nft_mint (the NFT's mint)
///   [1] nft_token_account (user's token account for the NFT, amount >= 1)
///   [2] nft_metadata (Metaplex metadata PDA)
///
/// Returns true if discount should be applied, false if no NFT accounts provided.
/// Errors if NFT accounts are provided but verification fails.
pub fn verify_nft_holder<'info>(
    remaining_accounts: &[AccountInfo<'info>],
    user: &Pubkey,
    expected_collection: &Pubkey,
) -> Result<bool> {
    if remaining_accounts.is_empty() {
        return Ok(false);
    }

    require!(remaining_accounts.len() >= 3, AgioError::InvalidNftMetadata);

    let nft_mint = &remaining_accounts[0];
    let nft_token_account = &remaining_accounts[1];
    let nft_metadata = &remaining_accounts[2];

    // Verify metadata account is owned by Metaplex Token Metadata program
    require!(
        nft_metadata.owner == &TOKEN_METADATA_PROGRAM_ID,
        AgioError::InvalidNftMetadata
    );

    // Verify metadata PDA
    let (expected_metadata, _) = Pubkey::find_program_address(
        &[
            b"metadata",
            TOKEN_METADATA_PROGRAM_ID.as_ref(),
            nft_mint.key.as_ref(),
        ],
        &TOKEN_METADATA_PROGRAM_ID,
    );
    require!(
        nft_metadata.key() == expected_metadata,
        AgioError::InvalidNftMetadata
    );

    // Parse collection from metadata
    let metadata_data = nft_metadata.try_borrow_data()?;
    let (verified, collection_key) =
        parse_metadata_collection(&metadata_data).ok_or(AgioError::InvalidNftMetadata)?;

    require!(verified, AgioError::NftCollectionNotVerified);
    require!(
        collection_key == *expected_collection,
        AgioError::InvalidNftCollection
    );

    // Verify the user actually holds this NFT
    // Token account data: mint(32) + owner(32) + amount(8) = first 72 bytes
    let token_data = nft_token_account.try_borrow_data()?;
    require!(token_data.len() >= 72, AgioError::NftNotHeld);

    let token_mint = Pubkey::from(<[u8; 32]>::try_from(&token_data[0..32]).unwrap());
    let token_owner = Pubkey::from(<[u8; 32]>::try_from(&token_data[32..64]).unwrap());
    let token_amount = u64::from_le_bytes(token_data[64..72].try_into().unwrap());

    require!(token_mint == nft_mint.key(), AgioError::NftNotHeld);
    require!(token_owner == *user, AgioError::NftNotHeld);
    require!(token_amount >= 1, AgioError::NftNotHeld);

    Ok(true)
}
