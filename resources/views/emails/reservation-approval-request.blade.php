<p>A new BoardRoom reservation is pending approval.</p>

@if(!empty($seriesCount) && $seriesCount > 1)
    <p><strong>Recurring:</strong> {{ $seriesCount }} occurrences are pending approval.</p>
@endif

<ul>
    <li><strong>Title:</strong> {{ $reservation->title }}</li>
    <li><strong>Requested by:</strong>
        {{ $reservation->requester_email ?? $reservation->requester?->email }}
    </li>
    <li><strong>Department:</strong> {{ $reservation->requester_department }}</li>
    @if(!empty($reservation->requester_attendees))
        <li><strong>Attendees:</strong> {{ $reservation->requester_attendees }}</li>
    @endif
    <li><strong>Room:</strong> {{ $reservation->meetingRoom?->name }}</li>
    <li><strong>Start:</strong> {{ optional($reservation->start_at)->format('n/j/Y g:i A') }}</li>
    <li><strong>End:</strong> {{ optional($reservation->end_at)->format('n/j/Y g:i A') }}</li>
</ul>

<p>
    <a href="{{ $approveUrl }}" style="display:inline-block; background:#0f172a; color:#fff; text-decoration:none; padding:10px 14px; border-radius:10px;">
        Approve
    </a>
    <a href="{{ $rejectUrl }}" style="display:inline-block; background:#fff; color:#0f172a; text-decoration:none; padding:10px 14px; border-radius:10px; border:1px solid #cbd5e1; margin-left:8px;">
        Disapprove
    </a>
</p>

<p style="color:#64748b; font-size:12px;">These links expire in 3 days.</p>
