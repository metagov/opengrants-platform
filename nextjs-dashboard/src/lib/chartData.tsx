// --- nextjs-dashboard/src/lib/chartData.tsx
// Transform database data to chart-ready format
export const transformPlatformData = (data) => {
  return data?.map(item => ({
    name: item.platform.toUpperCase(),
    value: item.total_funding_usd,
    color: getPlatformColor(item.platform)
  })) || []
}

export const transformFundingDistribution = (data) => {
  return data?.map(item => ({
    name: item.platform.toUpperCase(),
    value: item.total_funding_usd,
    color: getPlatformColor(item.platform)
  })) || []
}

export const transformVotingData = (privoteData) => {
  if (!privoteData) return []
  
  return [
    { name: "Total Applications", value: privoteData.total_applications, color: "blue.solid" },
    { name: "Total Votes", value: privoteData.total_votes, color: "green.solid" },
    { name: "Funded Projects", value: privoteData.funded_projects, color: "purple.solid" }
  ]
}

export const transformTemporalData = (data) => {
  return data?.map(item => ({
    month: formatMonth(item.year_quarter),
    funding: item.total_funding_usd,
    projects: item.projects_funded
  })) || []
}

// Helper functions
const getPlatformColor = (platform) => {
  const colors = {
    giveth: "teal.solid",
    scf: "blue.solid", 
    privote: "purple.solid"
  }
  return colors[platform] || "gray.solid"
}

const formatMonth = (quarter) => {
  const quarters = { 'Q1': 'Jan-Mar', 'Q2': 'Apr-Jun', 'Q3': 'Jul-Sep', 'Q4': 'Oct-Dec' }
  const [year, q] = quarter.split('-')
  return `${quarters[q]} ${year}`
}