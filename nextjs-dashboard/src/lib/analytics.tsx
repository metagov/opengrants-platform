export async function getGivethAnalytics() {
  try {
    const response = await fetch('/api/systems/giveth');
    if (!response.ok) {
      throw new Error('Failed to fetch Giveth analytics');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching Giveth analytics:', error);
    return {
      total_projects: 0,
      total_funding_usd: 0,
      total_donations: 0,
    };
  }
}
