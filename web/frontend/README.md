This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

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

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Environment variables

Set the OpenStates API key so the Voice for Justice module can load real representatives:

```
# web/frontend/.env.local
OPENSTATES_API_KEY=your_api_key
```

The key is only read on the server (via the Next.js API route at `app/api/civic/route.ts`), so keep it out of the client bundle by leaving it in `.env.local` and restart `npm run dev` after changes.
