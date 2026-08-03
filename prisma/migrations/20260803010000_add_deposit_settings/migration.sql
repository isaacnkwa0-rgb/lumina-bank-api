-- CreateTable
CREATE TABLE "DepositSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "bankAccountName" TEXT NOT NULL DEFAULT 'Lumina Bank Client Accounts',
    "bankSortCode" TEXT NOT NULL DEFAULT '20-45-78',
    "bankAccountNumber" TEXT NOT NULL DEFAULT '12345678',
    "bankIban" TEXT NOT NULL DEFAULT 'GB29NWBK60161331926819',
    "cryptoWallets" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepositSettings_pkey" PRIMARY KEY ("id")
);

-- Seed default row
INSERT INTO "DepositSettings" ("id", "bankAccountName", "bankSortCode", "bankAccountNumber", "bankIban", "cryptoWallets", "updatedAt")
VALUES (
  'default',
  'Lumina Bank Client Accounts',
  '20-45-78',
  '12345678',
  'GB29NWBK60161331926819',
  '{"BTC":{"address":"bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh","network":"Bitcoin"},"ETH":{"address":"0x71C7656EC7ab88b098defB751B7401B5f6d8976F","network":"Ethereum (ERC-20)"},"USDT":{"address":"0x71C7656EC7ab88b098defB751B7401B5f6d8976F","network":"Ethereum (ERC-20)"},"BNB":{"address":"bnb1grpf0955h0ykzq3ar5nmum7y6gdfl6lxfn46h2","network":"BNB Chain"},"SOL":{"address":"So11111111111111111111111111111111111111112","network":"Solana"}}',
  NOW()
)
ON CONFLICT ("id") DO NOTHING;
