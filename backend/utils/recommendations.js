import axios from "axios"

// AI-powered recommendations using a simple algorithm
export const getRecommendations = async (userId, db) => {
  try {
    const user = await db.getUserById(userId)
    const userFavorites = await db.getUserFavorites(userId)
    const favoriteListingIds = userFavorites.map((f) => f.listing_id)

    // Get all listings
    const allListings = await db.getListings({
      college: user.college_name,
    })

    // Filter out already favorited listings
    const recommendations = allListings
      .filter((l) => !favoriteListingIds.includes(l.id))
      .sort((a, b) => {
        // Score based on similarity
        let scoreA = 0
        let scoreB = 0

        // Prefer listings in same college
        if (a.college_name === user.college_name) scoreA += 10
        if (b.college_name === user.college_name) scoreB += 10

        // Prefer verified listings
        if (a.is_verified) scoreA += 5
        if (b.is_verified) scoreB += 5

        // Prefer listings with higher landlord ratings
        scoreA += (a.users?.rating || 0) * 2
        scoreB += (b.users?.rating || 0) * 2

        return scoreB - scoreA
      })
      .slice(0, 10)

    return recommendations
  } catch (error) {
    console.error("Recommendation error:", error)
    return []
  }
}

// Call external AI API for advanced recommendations
export const getAIRecommendations = async (userId, preferences) => {
  try {
    const response = await axios.post(
      process.env.AI_API_URL,
      {
        userId,
        preferences,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.AI_API_KEY}`,
        },
      },
    )
    return response.data
  } catch (error) {
    console.error("AI recommendation error:", error)
    return []
  }
}
