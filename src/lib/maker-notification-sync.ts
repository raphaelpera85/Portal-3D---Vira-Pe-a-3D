export function isMakerRealtimeUnavailable(status: string) {
  return status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED";
}
