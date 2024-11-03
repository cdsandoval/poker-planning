# Planning Poker

A real-time Planning Poker application for agile teams to estimate work items collaboratively.

## Features

- 🔄 Real-time updates using Supabase
- 🎮 Simple and intuitive interface
- 👥 Multiple participants support
- 🔗 Shareable room links
- 📊 Automatic average calculation
- 🎯 Standard Planning Poker values (0-55)
- 🔒 Reveal/Hide voting mechanism

## Tech Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- Supabase (Backend & Real-time)
- React Router

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Supabase account

### Installation

1. Clone the repository
2. Install dependencies

   ```bash
    yarn
   ```

3. Create a .env.local file in the root directory and add your Supabase credentials:

   ```bash
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. Start the development server

   ```bash
   yarn dev
   ```

## How to Use

Creating a Room

1. Click "Create New Room" on the home page
2. Enter your name
3. Share the room URL or room ID with your team members

Joining a Room

    1. Get the room URL or ID from the room creator
    2. If you have the URL, just open it in your browser
    3. If you have the ID:
      - Click "Join Existing Room" on the home page
      - Enter your name
      - Enter the room ID
      - Click "Join Room"

During Planning

Voting

1. Wait for the moderator to describe the item
2. Click on a card with your estimate (0-55)
3. Your vote is hidden until revealed

Revealing Votes

1. Once everyone has voted, the "Reveal" button becomes active
2. Click "Reveal" to show all votes
3. The average is automatically calculated

New Round

    1. Click "Reset" to clear all votes
    2. All participants return to voting state
    3. Votes are hidden again

Leaving a Room

    1. Click "Leave Room" to exit
    2. Your vote is removed from the room
    3. You can rejoin later with the same room ID

## Contributing

Feel free to contribute to this project by opening an issue or creating a pull request.

## License

Distributed under the MIT License. See `LICENSE` for more information.
