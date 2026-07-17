type SupabaseResult = {
  error: { message: string } | null
}

const CLOCK_SKEW_RETRY_DELAYS = [500, 1_500, 3_000]

function isJwtClockSkewError(error: SupabaseResult['error']) {
  return error?.message.toLowerCase().includes('jwt issued at future') === true
}

export async function withSupabaseClockSkewRetry<T extends SupabaseResult>(
  query: () => PromiseLike<T>,
) {
  let result = await query()

  for (const delay of CLOCK_SKEW_RETRY_DELAYS) {
    if (!isJwtClockSkewError(result.error)) return result

    await new Promise((resolve) => setTimeout(resolve, delay))
    result = await query()
  }

  return result
}
