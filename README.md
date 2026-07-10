# Collaborative Workspace - Real-time Kanban Collaboration Platform

A premium, real-time collaborative Kanban board application (similar to Trello and Jira) built with a modern backend and frontend architecture. This project enables teams to create projects, manage task boards, configure team member roles, and sync state updates instantly across clients.

---

## 🌟 Key Features

*   **Real-time Synchronization**: Powered by **ASP.NET Core SignalR**. Task dragging, column changes, and project updates sync instantly across all active users in a project space.
*   **Access Control & Roles**: Supports fine-grained permissions per project:
    *   **ADMIN**: Full management capabilities including project details, member roles, member removals, and project deletion.
    *   **MEMBER**: Can create, edit, move, and delete tasks/columns.
    *   **VIEWER**: Read-only access. Drag-and-drop is disabled, cursor actions are constrained, and settings tabs are read-only.
*   **Interactive Kanban Board**: Built with **React** and **@dnd-kit**:
    *   Smooth pointer-based collision detection (`pointerWithin` strategy) for accurate task reordering and cross-column drops.
    *   Support for Mouse and Touch sensors (preventing native gesture conflicts on mobile devices).
*   **Dual Light/Dark Theme Switcher**: A fully responsive dark/light mode switcher with user preference persistence stored in `localStorage`. Modals and input forms adapt beautifully with glassmorphism cards and high-contrast styling.
*   **Project Settings Modal**:
    *   **General Settings**: Name and description edits (Admins and Members).
    *   **Member Management**: Role promotions/demotions and team removals (Admins only).
    *   **Danger Zone**: Permanent project deletion (Admins only).
*   **Workspace Persistence**: The active project is preserved in `localStorage` so reloading the web page does not reset the user's workspace context.
*   **Rich UI Aesthetics**: Priority-colored left border tags on task cards (Red for High, Amber for Medium, Emerald for Low) and deterministic avatar background/text colors computed from user display names.

---

## 🛠️ Technology Stack

### Backend
*   **Framework**: C# .NET 8 / 9 (ASP.NET Core Web API)
*   **Database ORM**: Entity Framework Core
*   **Database**: Microsoft SQL Server
*   **Real-time Communication**: ASP.NET Core SignalR

### Frontend
*   **Framework & Bundler**: React 19, Vite
*   **Styling**: Tailwind CSS v3, custom theme fallback style overrides
*   **Icons**: Lucide React
*   **Drag-and-Drop**: @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/modifiers

---

## 🚀 Getting Started

### Prerequisites
*   [.NET SDK 8.0+](https://dotnet.microsoft.com/download)
*   [Node.js 18.0+](https://nodejs.org/)
*   SQL Server / localDB instance

### Setup and Running

#### 1. Database & Backend Configuration
1. Navigate to the backend directory:
    ```bash
    cd CollaborativeWorkspace.Backend
    ```
2. Update the connection string inside `appsettings.json` (or `appsettings.Development.json`) to point to your local SQL Server instance.
3. Apply Entity Framework migrations to seed the database:
    ```bash
    dotnet ef database update
    ```
4. Start the backend Web API:
    ```bash
    dotnet run
    ```
    The server will start listening on port `http://localhost:5049` (HTTP) and `https://localhost:7196` (HTTPS).

#### 2. Frontend Configuration
1. Navigate to the client directory:
    ```bash
    cd ../CollaborativeWorkspace.Client
    ```
2. Install the package dependencies:
    ```bash
    npm install
    ```
3. Run the Vite development server:
    ```bash
    npm run dev
    ```
4. Open your browser and navigate to `http://localhost:5173`.

---

## 🌿 Git Branching Strategy & Conventions

This project strictly adheres to professional engineering practices:

### Branch Types
*   `main`: Stable, production-ready code. Merged only from `develop`. No direct commits allowed.
*   `develop`: Main integration branch. Merges from `feature/*` and `defect/*`.
*   `feature/xxx`: For new feature development (e.g., `feature/project-settings-and-persistence`).
*   `defect/xxx`: For bug fixes.

### Commit Conventions
Commit messages are formatted as `<type>: <short description>`:
*   `feat`: Add a new feature (e.g., `feat: add JWT auth`)
*   `fix`: Fix a bug (e.g., `fix: resolve token validation bug`)
*   `docs`: Documentation updates (e.g., `docs: update API spec`)
*   `refactor`: Restructuring code without behavior changes
*   `test`: Adding or updating unit tests
*   `chore`: Tooling, configs, or package dependencies updates
