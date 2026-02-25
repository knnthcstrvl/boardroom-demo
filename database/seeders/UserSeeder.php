<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        User::query()->firstOrCreate(
            ['email' => 'admin@example.com'],
            [
                'name' => 'Admin User',
                'password' => Hash::make('password'),
                'is_admin' => true,
                'access' => ['add', 'edit', 'delete', 'approver'],
            ]
        );

        $users = [
            ['name' => 'Alex Booker', 'email' => 'alex.booker@example.com'],
            ['name' => 'Casey Rivera', 'email' => 'casey.rivera@example.com'],
            ['name' => 'Jordan Kim', 'email' => 'jordan.kim@example.com'],
            ['name' => 'Morgan Patel', 'email' => 'morgan.patel@example.com'],
            ['name' => 'Taylor Nguyen', 'email' => 'taylor.nguyen@example.com'],
        ];

        foreach ($users as $user) {
            User::query()->firstOrCreate(
                ['email' => $user['email']],
                [
                    'name' => $user['name'],
                    'password' => Hash::make('password'),
                    'is_admin' => false,
                    'access' => [],
                ]
            );
        }
    }
}

