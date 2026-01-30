import { UserPreferences } from "../models/UserPreferences.js";
import { emailService } from "./email-service.js";
import { NotificationService } from "../services/notification-service.js";

export const notifyMatchingUsers = async (listing) => {
  try {
    console.log("[PREFERENCE-MATCHER] ===== Starting preference matching =====");
    console.log("[PREFERENCE-MATCHER] Listing details:", {
      id: listing.id,
      title: listing.title,
      city: listing.city,
      rent_amount: listing.rent_amount,
      bedrooms: listing.bedrooms,
      type: listing.type
    });

    // Validate required fields
    if (!listing.city || !listing.rent_amount || !listing.bedrooms || !listing.type) {
      console.error("[PREFERENCE-MATCHER] ERROR: Missing required fields");
      throw new Error("Listing missing required fields for matching");
    }

    // Get users with matching preferences (3 or more criteria match)
    console.log("[PREFERENCE-MATCHER] Querying database for matching users...");
    const matchingUsers = await UserPreferences.getUsersWithMatchingPreferences(listing);

    console.log("[PREFERENCE-MATCHER] ===== Found", matchingUsers.length, "matching users =====");

    if (matchingUsers.length === 0) {
      console.log("[PREFERENCE-MATCHER] No users match this listing (need 3+ criteria matches)");
      return {
        success: true,
        notifiedCount: 0
      };
    }

    let successCount = 0;
    let failCount = 0;

    // Send email and in-app notification to each matching user
    for (const user of matchingUsers) {
      try {
        console.log("[PREFERENCE-MATCHER] Processing user:", user.email, "(match score:", user.match_score, ")");
        
        // Send email notification
        await emailService.sendNewListingNotification(
          user.email,
          user.name,
          listing
        );
        console.log("[PREFERENCE-MATCHER] ✅ Email sent to:", user.email);

        // Create in-app notification
        await NotificationService.notifyTenantMatchingListing(
          user.id,
          listing.title,
          listing.id
        );
        console.log("[PREFERENCE-MATCHER] ✅ In-app notification created for:", user.email);
        
        successCount++;
      } catch (error) {
        console.error("[PREFERENCE-MATCHER] ❌ Failed to notify user:", user.email);
        console.error("[PREFERENCE-MATCHER] Error details:", error.message);
        console.error("[PREFERENCE-MATCHER] Error stack:", error.stack);
        failCount++;
      }
    }

    console.log("[PREFERENCE-MATCHER] ===== Matching complete =====");
    console.log("[PREFERENCE-MATCHER] Success:", successCount, "Failed:", failCount);

    return {
      success: true,
      notifiedCount: successCount,
      failedCount: failCount
    };
  } catch (error) {
    console.error("[PREFERENCE-MATCHER] ===== CRITICAL ERROR =====");
    console.error("[PREFERENCE-MATCHER] Error:", error.message);
    console.error("[PREFERENCE-MATCHER] Stack:", error.stack);
    throw error;
  }
};
