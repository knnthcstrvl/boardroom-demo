<p>Your BoardRoom reservation request was updated.</p>

@if(!empty($seriesCount) && $seriesCount > 1)
    <p><strong>Recurring:</strong> {{ $seriesCount }} occurrences were updated.</p>
@endif

<ul>
    <li><strong>Status:</strong> {{ ucfirst($reservation->status->value) }}</li>
    <li><strong>Title:</strong> {{ $reservation->title }}</li>
    <li><strong>Department:</strong> {{ $reservation->requester_department }}</li>
    <li><strong>Room:</strong> {{ $reservation->meetingRoom?->name }}</li>
    <li><strong>Start:</strong> {{ optional($reservation->start_at)->format('n/j/Y g:i A') }}</li>
    <li><strong>End:</strong> {{ optional($reservation->end_at)->format('n/j/Y g:i A') }}</li>
    @if($reservation->status->value === 'rejected' && $reservation->rejected_reason)
        <li><strong>Reason:</strong> {{ $reservation->rejected_reason }}</li>
    @endif
</ul>

<p>View the calendar: <a href="{{ $kioskUrl }}">{{ $kioskUrl }}</a></p>
