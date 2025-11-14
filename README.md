# AI Design Canvas Template

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fkyh%2Fai-design-canvas)

A powerful, forkable canvas template for building your own design tools like Canva, Figma, or tldraw. This Next.js-based template provides a complete foundation for creating interactive canvas applications with AI-powered design generation.

## 🎨 Features

### Core Canvas Functionality
- **Interactive Canvas Editor** - Full-featured canvas with zoom, pan, and multi-select
- **Block System** - Support for text, frame, and image blocks
- **Layer Management** - Organize and manipulate design elements
- **Transform Controls** - Resize, rotate, and position elements with precision
- **Hotkey Support** - Keyboard shortcuts for efficient editing

### Design Controls
- **Text Styling** - Font selection, size, color, alignment, spacing, and decoration
- **Frame Styling** - Colors, borders, shadows, opacity, border radius, and rotation
- **Color Picker** - Advanced color selection with opacity support
- **Layout Controls** - Positioning, sizing, and alignment tools

### AI Integration
- **AI-Powered Design Generation** - Generate text, frames, and images using AI
- **Visual Context Awareness** - AI understands current canvas state
- **Build Mode** - Convert canvas designs into interactive HTML/CSS/JS code

### Developer Experience
- **TypeScript** - Fully typed for better development experience
- **Modern Stack** - Next.js 16, React 19, Konva for canvas rendering
- **State Management** - Zustand for efficient state handling
- **UI Components** - Radix UI primitives with custom styling (shadcn/ui)
- **Theme Support** - Dark/light mode with theme provider

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- pnpm (recommended) or npm/yarn/bun

### Installation

1. **Fork or clone this repository**

```bash
git clone https://github.com/your-username/ai-design-canvas.git
cd ai-design-canvas
```

2. **Install dependencies**

```bash
pnpm install
```

3. **Set up environment variables**

Create a `.env.local` file in the root directory:

```env
OPENAI_API_KEY=your_openai_api_key_here
```

4. **Run the development server**

```bash
pnpm dev
```

5. **Open your browser**

Navigate to [http://localhost:3000](http://localhost:3000) to see the canvas editor.

## 📁 Project Structure

```
src/
├── ai/                    # AI integration and prompts
│   ├── messages/          # Message types and metadata
│   ├── response/          # AI response handling
│   └── tools/             # AI tools for generating blocks
├── app/                   # Next.js app directory
│   ├── api/               # API routes
│   └── page.tsx           # Main page
├── components/
│   ├── canvas/            # Canvas editor components
│   │   ├── controls/      # Property controls
│   │   ├── hooks/         # Canvas-specific hooks
│   │   ├── services/      # Export, fonts, templates
│   │   ├── utils/         # Canvas utilities
│   │   └── views/         # Main editor views
│   └── ui/                # Reusable UI components (shadcn/ui)
├── data/                  # Template data
├── hooks/                 # Shared React hooks
└── lib/                   # Utilities and types
```

## 🛠️ Customization

### Adding New Block Types

1. Define the block type in `src/lib/types.ts`
2. Create a generator tool in `src/ai/tools/`
3. Add rendering logic in the canvas component
4. Create controls in `src/components/canvas/controls/`

### Customizing AI Behavior

- Modify prompts in `src/ai/response/`
- Adjust tool definitions in `src/ai/tools/`
- Update message handling in `src/ai/messages/`

### Styling and Theming

- Customize colors in `src/app/globals.css`
- Modify component styles in respective component files (components follow shadcn/ui patterns)
- Adjust theme settings in `src/components/theme-provider.tsx`

## 🎯 Use Cases

This template is perfect for building:

- **Design Tools** - Create your own Canva or Figma alternative
- **Prototyping Tools** - Build interactive prototyping applications
- **Diagram Editors** - Create flowcharts, mind maps, or diagrams
- **Presentation Builders** - Design slide or presentation creators
- **Whiteboard Apps** - Collaborative drawing and brainstorming tools
- **Custom Editors** - Any application requiring a canvas-based interface

## 🧩 Key Technologies

- **Next.js 16** - React framework with App Router
- **React 19** - UI library
- **Konva** - 2D canvas library for rendering
- **Zustand** - Lightweight state management
- **shadcn/ui** - Beautiful component library built on Radix UI
- **Radix UI** - Accessible component primitives
- **Tailwind CSS** - Utility-first styling
- **TypeScript** - Type safety
- **Vercel AI SDK** - AI integration

## 📝 License

This template is open source and available for you to fork and customize for your own projects.

## 🤝 Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

## 🔗 Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Konva Documentation](https://konvajs.org/docs/)
- [shadcn/ui Documentation](https://ui.shadcn.com/)
- [Radix UI Documentation](https://www.radix-ui.com/docs)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)

---

**Happy building!** 🎨 Fork this template and create your own canvas-based design tool.
