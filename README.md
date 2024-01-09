This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `pages/index.tsx`. The page auto-updates as you edit the file.

[API routes](https://nextjs.org/docs/api-routes/introduction) can be accessed on [http://localhost:3000/api/hello](http://localhost:3000/api/hello). This endpoint can be edited in `pages/api/hello.ts`.

The `pages/api` directory is mapped to `/api/*`. Files in this directory are treated as [API routes](https://nextjs.org/docs/api-routes/introduction) instead of React pages.

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.

## Features

- Render video, audio and chat from your agent
- Send video, audio, or text to your agent
- Configurable settings panel to work with your agent

## Notes

- Update `.env` to include

```
LIVEKIT_API_KEY=<your API KEY>
LIVEKIT_API_SECRET=<Your API Secret>
LIVEKIT_URL=<Your Cloud URL>
NEXT_PUBLIC_LIVEKIT_URL=<Your Cloud URL>
```

- This playground is currently work in progress. There are known layout/responsive bugs and some features are under tested.
- The playground was tested against the kitt example in `https://github.com/livekit/python-agents`.
- Feel free to ask questions, request features at #team-agents.
- Feel free to add features yourself if there's something you want to see

## Known issues

- "Disconnect" in header is not yet functional
- Layout can break on smaller screens.
- Mobile device sizes not supported currently
