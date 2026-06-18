// Generates a VAPID key pair for Web Push and prints the env vars to copy into
// .env (local) and the Vercel project settings. Run: npm run generate:vapid
import webpush from 'web-push'

const { publicKey, privateKey } = webpush.generateVAPIDKeys()

console.log('\nWeb Push VAPID keys generated. Add these to your environment:\n')
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`)
console.log(`VAPID_PRIVATE_KEY=${privateKey}`)
console.log('VAPID_SUBJECT=mailto:support@clearsight.app')
console.log(
  '\nNEXT_PUBLIC_VAPID_PUBLIC_KEY is exposed to the browser (safe). Keep VAPID_PRIVATE_KEY secret.\n'
)
