import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { handlePaidAction } from "./paid"
import { sanitizeError } from "@/lib/mcp/errors"
import { checkRateLimit } from "@/lib/mcp/x402-verify"
import {
  searchProfiles,
  getProfile,
  getCustomProperty,
  followUser,
  unfollowUser,
  checkFollowStatus,
  getFollowers,
  getFollowing,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  getReceivedFriendRequests,
  postLoanActivity,
  getActivityFeed,
} from "@/lib/tapestry-server"
import { notifyFriendRequest, notifyFriendAccepted, notifyNewFollower, notifyFriendRejected } from "@/lib/dialect"
import { jsonResult } from "./shared"

/**
 * Resolve a wallet address to a Tapestry profile ID.
 * Throws with a user-friendly message if no profile found.
 */
async function resolveProfileId(wallet: string): Promise<string> {
  const result = await searchProfiles(wallet, 1, 0)
  const profile = result.profiles[0]
  if (!profile?.profile?.id) {
    throw new Error(
      `Profile not found for wallet ${wallet}. Create a profile first using the create-profile tool.`,
    )
  }
  return profile.profile.id
}

/**
 * Resolve a target wallet to a profile ID.
 * Throws TARGET_PROFILE_NOT_FOUND (distinct from PROFILE_NOT_FOUND for own wallet).
 */
async function resolveTargetProfileId(wallet: string): Promise<string> {
  const result = await searchProfiles(wallet, 1, 0)
  const profile = result.profiles[0]
  if (!profile?.profile?.id) {
    throw new Error(
      `Target profile not found for wallet ${wallet}. The target user must create a profile first.`,
    )
  }
  return profile.profile.id
}

export function registerSocialTools(server: McpServer) {
  // --- follow-user ---
  server.tool(
    "follow-user",
    "Follow another user on the Agio platform by their wallet address. Free — no payment required.",
    {
      paymentProof: z
        .string()
        .optional()
        .describe("Base64-encoded signed USDC transfer transaction. Omit to get payment requirements."),
      wallet: z
        .string()
        .optional()
        .describe("Your Solana wallet address (required on devnet free mode)"),
      apiKey: z.string().optional().describe("API key from create-agent (required on devnet free mode)"),
      targetWallet: z
        .string()
        .describe("Wallet address of the user to follow"),
    },
    async (args, extra) => {
      return handlePaidAction(
        "follow-user",
        args.paymentProof,
        "Follow a user on Agio",
        async (wallet) => {
          const myProfileId = await resolveProfileId(wallet)
          const targetProfileId = await resolveTargetProfileId(args.targetWallet)

          if (myProfileId === targetProfileId) {
            throw new Error("Cannot follow yourself")
          }

          // Check if already following
          const status = await checkFollowStatus(myProfileId, targetProfileId)
          if (status.isFollowing) {
            throw new Error("Already following this user")
          }

          await followUser(myProfileId, targetProfileId)

          // Notify followed user (fire-and-forget)
          notifyNewFollower(args.targetWallet, myProfileId).catch(() => {})

          return {
            message: `Now following ${args.targetWallet}`,
            followerProfileId: myProfileId,
            followingProfileId: targetProfileId,
          }
        },
        extra,
        args.wallet,
        undefined,
        args.apiKey,
      )
    },
  )

  // --- unfollow-user ---
  server.tool(
    "unfollow-user",
    "Unfollow a user on the Agio platform. Free — no payment required.",
    {
      paymentProof: z
        .string()
        .optional()
        .describe("Base64-encoded signed USDC transfer transaction"),
      wallet: z
        .string()
        .optional()
        .describe("Your Solana wallet address (required on devnet free mode)"),
      apiKey: z.string().optional().describe("API key from create-agent (required on devnet free mode)"),
      targetWallet: z
        .string()
        .describe("Wallet address of the user to unfollow"),
    },
    async (args, extra) => {
      return handlePaidAction(
        "unfollow-user",
        args.paymentProof,
        "Unfollow a user on Agio",
        async (wallet) => {
          const myProfileId = await resolveProfileId(wallet)
          const targetProfileId = await resolveTargetProfileId(args.targetWallet)

          await unfollowUser(myProfileId, targetProfileId)
          return { message: `Unfollowed ${args.targetWallet}` }
        },
        extra,
        args.wallet,
        undefined,
        args.apiKey,
      )
    },
  )

  // --- send-friend-request ---
  server.tool(
    "send-friend-request",
    "Send a friend request to another user. Friends are mutual followers. Free — no payment required.",
    {
      paymentProof: z
        .string()
        .optional()
        .describe("Base64-encoded signed USDC transfer transaction"),
      wallet: z
        .string()
        .optional()
        .describe("Your Solana wallet address (required on devnet free mode)"),
      apiKey: z.string().optional().describe("API key from create-agent (required on devnet free mode)"),
      targetWallet: z
        .string()
        .describe("Wallet address of the user to send a friend request to"),
    },
    async (args, extra) => {
      return handlePaidAction(
        "send-friend-request",
        args.paymentProof,
        "Send a friend request on Agio",
        async (wallet) => {
          const myProfileId = await resolveProfileId(wallet)
          const targetProfileId = await resolveTargetProfileId(args.targetWallet)

          if (myProfileId === targetProfileId) {
            throw new Error("Cannot send a friend request to yourself")
          }

          const { sentContentId, receivedContentId } = await sendFriendRequest(
            myProfileId,
            targetProfileId,
            wallet,
            args.targetWallet,
          )

          // Notify target user via Dialect (fire-and-forget)
          notifyFriendRequest(args.targetWallet, myProfileId).catch(() => {})

          return {
            message: `Friend request sent to ${args.targetWallet}`,
            contentId: sentContentId,
            pairContentId: receivedContentId,
            senderProfileId: myProfileId,
            targetProfileId,
          }
        },
        extra,
        args.wallet,
        undefined,
        args.apiKey,
      )
    },
  )

  // --- respond-friend-request ---
  server.tool(
    "respond-friend-request",
    "Accept or reject a pending friend request. Accepting creates a mutual follow. Free — no payment required.",
    {
      paymentProof: z
        .string()
        .optional()
        .describe("Base64-encoded signed USDC transfer transaction"),
      wallet: z
        .string()
        .optional()
        .describe("Your Solana wallet address (required on devnet free mode)"),
      apiKey: z.string().optional().describe("API key from create-agent (required on devnet free mode)"),
      contentId: z
        .string()
        .describe("The content ID of the friend request to respond to"),
      pairContentId: z
        .string()
        .describe("The pair content ID of the friend request (from the sender's side)"),
      senderProfileId: z
        .string()
        .describe("The profile ID of the user who sent the request"),
      action: z
        .enum(["accept", "reject"])
        .describe("Whether to accept or reject the friend request"),
    },
    async (args, extra) => {
      return handlePaidAction(
        "respond-friend-request",
        args.paymentProof,
        "Respond to a friend request on Agio",
        async (wallet) => {
          const myProfileId = await resolveProfileId(wallet)

          if (args.action === "accept") {
            const ok = await acceptFriendRequest(
              args.contentId,
              args.pairContentId,
              myProfileId,
              args.senderProfileId,
            )
            if (!ok) throw new Error("Failed to accept friend request")

            // Notify sender that their request was accepted (fire-and-forget)
            getProfile(args.senderProfileId)
              .then((senderProfile) => {
                const senderWallet = senderProfile.profile?.walletAddress
                if (senderWallet) {
                  notifyFriendAccepted(senderWallet, myProfileId).catch(() => {})
                }
              })
              .catch(() => {})

            return { message: "Friend request accepted. You are now mutual followers." }
          } else {
            const ok = await rejectFriendRequest(args.contentId, args.pairContentId)
            if (!ok) throw new Error("Failed to reject friend request")

            // Notify sender their request was rejected (fire-and-forget)
            getProfile(args.senderProfileId)
              .then((senderProfile) => {
                const senderWallet = senderProfile.profile?.walletAddress
                if (senderWallet) {
                  notifyFriendRejected(senderWallet, myProfileId).catch(() => {})
                }
              })
              .catch(() => {})

            return { message: "Friend request rejected." }
          }
        },
        extra,
        args.wallet,
        undefined,
        args.apiKey,
      )
    },
  )

  // --- post-activity ---
  server.tool(
    "post-activity",
    "Post a loan activity event to your social feed (e.g. created offer, accepted loan). Free — no payment required.",
    {
      paymentProof: z
        .string()
        .optional()
        .describe("Base64-encoded signed USDC transfer transaction"),
      wallet: z
        .string()
        .optional()
        .describe("Your Solana wallet address (required on devnet free mode)"),
      apiKey: z.string().optional().describe("API key from create-agent (required on devnet free mode)"),
      event: z
        .enum(["created", "accepted", "repaid", "foreclosed"])
        .describe("The type of loan event"),
      loanType: z.string().optional().describe("Loan type description (e.g. 'lend offer')"),
      debtToken: z.string().optional().describe("Debt token symbol (e.g. USDC)"),
      collateralToken: z.string().optional().describe("Collateral token symbol (e.g. SOL)"),
      amount: z.number().optional().describe("Loan amount"),
      apy: z.number().optional().describe("APY percentage"),
      duration: z.number().optional().describe("Duration in seconds"),
      txSignature: z.string().optional().describe("Transaction signature"),
    },
    async (args, extra) => {
      return handlePaidAction(
        "post-activity",
        args.paymentProof,
        "Post a loan activity to your social feed",
        async (wallet) => {
          const profileId = await resolveProfileId(wallet)

          const result = await postLoanActivity(profileId, args.event, {
            loanType: args.loanType,
            debtToken: args.debtToken,
            collateralToken: args.collateralToken,
            amount: args.amount,
            apy: args.apy,
            duration: args.duration,
            txSignature: args.txSignature,
          })

          return {
            message: "Activity posted to your social feed",
            contentId: result?.contentId || null,
          }
        },
        extra,
        args.wallet,
        undefined,
        args.apiKey,
      )
    },
  )

  // --- get-activity-feed (FREE) ---
  server.tool(
    "get-activity-feed",
    "Get the loan activity feed for a user and their following. Free — no payment required.",
    {
      wallet: z
        .string()
        .describe("Wallet address to get the activity feed for"),
      pageSize: z
        .number()
        .min(1)
        .max(50)
        .optional()
        .describe("Number of items to return (default 20)"),
    },
    async (args) => {
      // Rate limit check (free tool)
      const allowed = await checkRateLimit(args.wallet, false)
      if (!allowed) {
        return jsonResult({ success: false, error: "Rate limit exceeded. Try again in 60 seconds.", errorCode: "RATE_LIMITED" })
      }

      try {
        const profileResult = await searchProfiles(args.wallet, 1, 0)
        const profile = profileResult.profiles[0]
        if (!profile?.profile?.id) {
          return jsonResult({ success: false, error: `No profile found for wallet ${args.wallet}. Create one first using create-profile.`, errorCode: "PROFILE_NOT_FOUND" })
        }

        const profileId = profile.profile.id

        // Get who this user follows
        const followingRes = await getFollowing(profileId, 50, 1)
        const followingIds = (followingRes.profiles || []).map(
          (p: any) => p.profile?.id || p.id,
        )

        // Include the user's own activity + following
        const allProfileIds = [profileId, ...followingIds]
        const feed = await getActivityFeed(allProfileIds, args.pageSize || 20)

        // Get friend requests for this user
        const friendRequests = await getReceivedFriendRequests(profileId, "pending")

        return jsonResult({
          success: true,
          feed,
          pendingFriendRequests: friendRequests.length,
          friendRequests: friendRequests.slice(0, 5),
        })
      } catch (err: any) {
        const { code, message } = sanitizeError(err)
        return jsonResult({ success: false, error: message, errorCode: code })
      }
    },
  )
}
