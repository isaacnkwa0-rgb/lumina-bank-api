-- Add sender relation to SupportMessage
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add index for senderId lookups
CREATE INDEX "SupportMessage_senderId_idx" ON "SupportMessage"("senderId");
