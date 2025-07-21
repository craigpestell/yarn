# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      ...tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      ...tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      ...tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
# 🧵 Conspiracy Pinboard

An interactive web application for creating visual conspiracy maps using polaroid-style photo components connected with yarn strings.

## Features

- **Polaroid Photos**: Create photo components that represent URLs to webpages
- **Drag & Drop**: Freely position photos on the pinboard
- **Yarn Connections**: Draw string connections between related photos
- **Rich Editing**: Add titles, notes, and images to each photo
- **Interactive UI**: Click to edit, drag to move, connect to link

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## How to Use

1. **Add Photos**: Click the "+" button in the toolbar to add a new polaroid photo
2. **Edit Photos**: Click on any photo to open the editor and add:
   - Title and URL
   - Custom image (optional)
   - Conspiracy notes
3. **Move Photos**: Drag photos around the pinboard to organize your conspiracy map
4. **Connect Photos**: Click the connection button and then click on two photos to connect them with yarn
5. **Delete Photos**: Use the delete button in the photo editor

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Styled Components** - Component styling
- **@dnd-kit** - Drag and drop functionality
- **Konva/React-Konva** - Canvas rendering for yarn connections
- **Lucide React** - Beautiful icons

## Project Structure

```
src/
├── components/
│   ├── Pinboard.tsx      # Main canvas area
│   ├── PolaroidPhoto.tsx # Individual photo components
│   ├── PhotoEditor.tsx   # Photo editing modal
│   └── Toolbar.tsx       # Bottom toolbar
├── types.ts              # TypeScript definitions
├── App.tsx              # Main application
└── main.tsx             # Entry point
```

## Development

The project uses modern React patterns with hooks and TypeScript for type safety. The drag-and-drop functionality is powered by @dnd-kit, while yarn connections are rendered using Konva for smooth canvas interactions.

## Contributing

Feel free to contribute by adding new features like:
- Save/load functionality
- Export to image
- Collaborative editing
- Photo import from URLs
- Custom yarn colors
- Pinboard templates
```
