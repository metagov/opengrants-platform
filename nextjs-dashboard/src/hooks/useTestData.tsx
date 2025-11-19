import useSWR from 'swr'

const fetcher = (url) => fetch(url).then(r => r.json())

export function useTestData() {
  const { data, error, isLoading } = useSWR('/api/test-data', fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false
  })

  return {
    data,
    isLoading,
    isError: error,
    isSuccess: data?.success
  }
}