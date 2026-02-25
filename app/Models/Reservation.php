<?php

namespace App\Models;

use App\Enums\ReservationStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Reservation extends Model
{
    use HasFactory;

    protected $fillable = [
        'meeting_room_id',
        'requested_by',
        'requester_email',
        'requester_department',
        'requester_attendees',
        'approved_by',
        'title',
        'start_at',
        'end_at',
        'status',
        'rejected_reason',
        'repeat_enabled',
        'repeat_unit',
        'repeat_weeks',
        'repeat_days',
        'repeat_start_date',
        'repeat_series_id',
    ];

    protected function casts(): array
    {
        return [
            'start_at' => 'datetime',
            'end_at' => 'datetime',
            'status' => ReservationStatus::class,
            'repeat_enabled' => 'boolean',
            'repeat_days' => 'array',
            'repeat_start_date' => 'date',
        ];
    }

    public function meetingRoom(): BelongsTo
    {
        return $this->belongsTo(MeetingRoom::class);
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }
}
