import { NextResponse } from "next/server"
import {
  notifyFriendRequest,
  notifyFriendAccepted,
  notifyFriendRejected,
  notifyLoanCreated,
  notifyLoanAccepted,
  notifyLoanRepaid,
  notifyLoanForeclosed,
  notifyNetworkLoanCreated,
  notifyCollateralAdded,
  notifyNewFollower,
} from "@/lib/dialect"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { type, recipientWallet, senderName, details } = body

    if (!type || !recipientWallet) {
      return NextResponse.json({ error: "Missing type or recipientWallet" }, { status: 400 })
    }

    switch (type) {
      case "friend_request":
        await notifyFriendRequest(recipientWallet, senderName || "Someone")
        break
      case "friend_accepted":
        await notifyFriendAccepted(recipientWallet, senderName || "Someone")
        break
      case "loan_created":
        await notifyLoanCreated(recipientWallet, details || {})
        break
      case "loan_accepted":
        await notifyLoanAccepted(recipientWallet, details || {})
        break
      case "loan_repaid":
        await notifyLoanRepaid(recipientWallet, details || {})
        break
      case "loan_foreclosed":
        await notifyLoanForeclosed(recipientWallet, details || {})
        break
      case "loan_created_network":
        await notifyNetworkLoanCreated(recipientWallet, details || {})
        break
      case "collateral_added":
        await notifyCollateralAdded(recipientWallet, details || {})
        break
      case "new_follower":
        await notifyNewFollower(recipientWallet, senderName || "Someone")
        break
      case "friend_rejected":
        await notifyFriendRejected(recipientWallet, senderName || "Someone")
        break
      default:
        return NextResponse.json({ error: `Unknown notification type: ${type}` }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to send notification" }, { status: 500 })
  }
}
