export function createReservationStream({ meetingRoomId } = {}) {
  const params = new URLSearchParams()
  if (meetingRoomId) params.set("meeting_room_id", String(meetingRoomId))

  const url = `/api/stream/reservations?${params.toString()}`
  const es = new EventSource(url)

  return es
}

