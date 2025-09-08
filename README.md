# Cast Airdrop Mini App

Create airdrops for users who engage with your Farcaster posts using Mint Club SDK and Neynar API.

## Features

- 🎯 **Target Engaged Users**: Automatically find users who liked, recasted, commented, or quoted your Farcaster posts
- 🪂 **Easy Airdrop Creation**: Create airdrops with just a few clicks using Mint Club SDK
- 🎨 **Beautiful UI**: Clean, modern interface built with ReactBits design system
- 🔗 **Direct Integration**: Seamless integration with Farcaster and Base network
- 📱 **Mobile Optimized**: Works perfectly on mobile devices and Warpcast

## How It Works

1. **Enter Post URL**: Paste a Farcaster post URL
2. **Analyze Users**: Automatically find users who engaged with the post
3. **Configure Airdrop**: Set token, amount, and target criteria
4. **Review & Create**: Review settings and create the airdrop
5. **Share Link**: Get a direct link to your Mint Club airdrop

## Setup

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Neynar API key
- Filebase API key for IPFS storage (as recommended by Mint Club SDK)

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd cast-airdrop
```

2. Install dependencies:
```bash
npm install
```

3. Create environment variables:
```bash
cp .env.example .env.local
```

4. Add your API keys to `.env.local`:
```env
# Neynar API Key (get from https://dev.neynar.com/app)
NEXT_PUBLIC_NEYNAR_API_KEY=your_neynar_api_key_here

# Filebase API Key (get from https://filebase.com - recommended by Mint Club SDK)
FILEBASE_API_KEY=your_filebase_api_key_here

# WalletConnect Project ID (get from https://cloud.walletconnect.com)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id_here
```

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## API Keys Setup

### Neynar API Key
1. Go to [https://dev.neynar.com/app](https://dev.neynar.com/app)
2. Create a new app or use existing one
3. Copy your API key
4. Add to `NEXT_PUBLIC_NEYNAR_API_KEY` in `.env.local`

### Filebase API Key
1. Go to [https://filebase.com/](https://filebase.com/)
2. Create an account and get your API key
3. Add to `FILEBASE_API_KEY` in `.env.local`

## Usage

### Creating an Airdrop

1. **Enter Post URL**: Paste a Farcaster post URL (e.g., `https://farcaster.xyz/project7/0xcfc31437`)

2. **Analyze Users**: The app will automatically:
   - Extract the cast hash from the URL
   - Fetch users who liked, recasted, commented, or quoted the post
   - Filter users with verified wallet addresses

3. **Configure Airdrop**:
   - **Title**: Give your airdrop a name
   - **Token**: Select from predefined tokens or enter a custom address
   - **Total Amount**: Set the total amount to distribute
   - **End Date**: Choose when the airdrop should end
   - **Target Users**: Choose which type of engagement to target

4. **Review & Create**: 
   - Review the configuration
   - Click "Create Airdrop" to deploy on Mint Club

5. **Share**: Copy the generated Mint Club airdrop link and share it with your community

### Supported Tokens

The app comes with predefined tokens on Base network:
- **WETH**: Wrapped Ether
- **USDC**: USD Coin  
- **cbETH**: Coinbase Wrapped Staked ETH
- **Custom**: Any ERC-20 token address

## Technical Details

### Architecture

- **Frontend**: Next.js 14 with TypeScript
- **Styling**: Tailwind CSS with custom ReactBits design system
- **APIs**: Neynar API for Farcaster data, Mint Club SDK for airdrops
- **Storage**: Filebase for IPFS wallet list storage (recommended by Mint Club SDK)
- **Network**: Base network for transactions

### Key Components

- `src/lib/neynar.ts`: Neynar API integration for fetching cast data
- `src/lib/mintclub.ts`: Mint Club SDK integration for airdrop creation
- `src/components/ui/`: Reusable UI components (Card, Button, Input, Select)
- `src/app/page.tsx`: Main application with step-by-step flow

### API Endpoints Used

**Neynar API:**
- `GET /v2/farcaster/cast` - Get cast by hash
- `GET /v2/farcaster/cast/reactions` - Get cast reactions (likes, recasts)
- `GET /v2/farcaster/cast/conversation` - Get cast comments
- `GET /v2/farcaster/cast/quotes` - Get cast quotes

**Mint Club SDK:**
- `createAirdrop()` - Create new airdrop
- `generateMerkleRoot()` - Generate merkle root for wallet list
- `uploadWalletsToIPFS()` - Upload wallet list to IPFS using Filebase

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

### Other Platforms

The app can be deployed to any platform that supports Next.js:
- Netlify
- Railway
- DigitalOcean App Platform
- AWS Amplify

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

- **Documentation**: [Mint Club SDK](https://sdk.mint.club/docs/sdk/airdrop/createAirdrop)
- **Neynar Docs**: [Farcaster Mini App Guide](https://docs.neynar.com/docs/create-farcaster-miniapp-in-60s)
- **Issues**: Create an issue on GitHub

## Roadmap

- [ ] Support for multiple networks (Ethereum, Polygon, etc.)
- [ ] Advanced filtering options (followers only, specific time ranges)
- [ ] Batch airdrop creation
- [ ] Analytics dashboard
- [ ] Social sharing features
- [ ] Mobile app version

