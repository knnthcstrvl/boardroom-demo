export function createUserStream() {
  return new EventSource("/api/stream/users")
}

