<!--BEGIN_BANNER_IMAGE-->
  <!--END_BANNER_IMAGE-->

# LiveKit Agent Playground

<!--BEGIN_DESCRIPTION-->
<!--END_DESCRIPTION-->

## Docs and references

Docs for how to get started with LiveKit agents at [https://docs.livekit.io/agents](https://docs.livekit.io/agents)

The repo containing the (server side) agent implementations (including example agents): [https://github.com/livekit/agents](https://github.com/livekit/agents)

## Setting up the playground locally

1. Install dependencies

```bash
  npm install
```

2. Copy and rename the `.env.example` file to `.env.local` and fill in the necessary environment variables.

```
LIVEKIT_API_KEY=<your API KEY>
LIVEKIT_API_SECRET=<Your API Secret>
NEXT_PUBLIC_LIVEKIT_URL=wss://<Your Cloud URL>
```

3. Run the development server:

```bash
  npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
5. If you haven't done so yet, start your agent (with the same project variables as in step 2.)
6. Connect to a room and see your agent connecting to the playground

## Features

- Render video, audio and chat from your agent
- Send video, audio, or text to your agent
- Configurable settings panel to work with your agent

## Notes

- This playground is currently work in progress. There are known layout/responsive bugs and some features are under tested.
- The playground was tested against the kitt example in `https://github.com/livekit/agents`.
- Feel free to ask questions, request features in our [community slack](https://livekit.io/join-slack).

## Known issues

- Layout can break on smaller screens.
- Mobile device sizes not supported currently

<!--BEGIN_REPO_NAV-->
<!--END_REPO_NAV-->
