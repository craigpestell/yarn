# Copilot Instructions

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

## Project Overview
This is a conspiracy pinboard web application where users can:
- Create polaroid-style photo components representing URLs
- Add, edit, and delete photo components with notes
- Connect photos with draggable yarn strings
- Build visual conspiracy maps

## Technical Stack
- React 18 with TypeScript
- Vite for build tooling
- @dnd-kit for drag and drop functionality
- Konva/react-konva for canvas interactions
- styled-components for styling
- Lucide React for icons

## Code Style Guidelines
- Use TypeScript for all components and utilities
- Implement responsive design principles
- Follow React hooks best practices
- Use styled-components for component styling
- Maintain clean separation between UI components and business logic
- Use semantic HTML and accessibility best practices

## Component Architecture
- `PolaroidPhoto` - Individual photo components with URL, image, and notes
- `YarnConnection` - Visual connection lines between photos
- `Pinboard` - Main canvas area for placing and connecting photos
- `PhotoEditor` - Modal/sidebar for editing photo details
- `ConnectionManager` - Handles yarn connections between photos

## Key Features to Implement
- Drag and drop photo placement
- Click and drag yarn connection creation
- Photo editing with URL preview and notes
- Persistent state management
- Responsive pinboard layout
- Visual feedback for interactions
