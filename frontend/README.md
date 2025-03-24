# Construction Map Viewer

This is a frontend application for the Construction Map Viewer, built with React.

## Project Structure

The project follows a clean, component-based architecture:

- `src/components/`: Reusable UI components
- `src/pages/`: Page-level components
- `src/services/`: API and service functions
- `src/assets/`: Styles and static assets

## Getting Started

### Prerequisites

- Node.js (>= 14.x)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd frontend
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Start the development server:
```bash
npm start
# or
yarn start
```

The application will be available at [http://localhost:3000](http://localhost:3000).

## API Configuration

The application is configured to connect to the backend API at `http://localhost:8000`. If your API is running on a different URL, update the `API_URL` constant in the following files:

- `src/services/authService.js`
- `src/services/mapService.js`
- `src/services/eventService.js`

## Building for Production

To create a production build:

```bash
npm run build
# or
yarn build
```

The build will be created in the `build` folder.

## Features

- User authentication
- Project, map, and event management
- Interactive map markers for events
- Responsive design with Bootstrap

## Features (Planned)

- Responsive UI for desktop and mobile
- Interactive map display with overlay capabilities
- Authentication and user management
- Project navigation and management
- Event creation, display, and filtering
- Data export functionality

## Tech Stack

- **React**: Frontend library
- **React Router**: For navigation
- **Leaflet/OpenLayers**: For map display
- **Axios**: For API requests
- **React Query**: For state management
- **Tailwind CSS**: For styling

## Development Setup (Coming Soon)

This part of the project is under development.

1. Install dependencies:
   ```
   npm install
   ```

2. Start the development server:
   ```
   npm start
   ```

3. Access the application at http://localhost:3000

## Project Structure (Planned)

```
frontend/
├── public/
├── src/
│   ├── assets/          # Static assets
│   ├── components/      # Reusable components
│   ├── context/         # React context providers
│   ├── hooks/           # Custom hooks
│   ├── pages/           # Page components
│   ├── services/        # API services
│   ├── types/           # TypeScript types
│   ├── utils/           # Utility functions
│   ├── App.tsx          # Main App component
│   └── index.tsx        # Application entry point
└── package.json         # Dependencies and scripts
``` 