# Credit-First Payment System

## Overview
Your RigSnap app now prioritizes credits over payment methods for all transactions. Users can now:
- ✅ Create requests with sufficient credits (no payment method required)
- ✅ Accept requests with sufficient credits (no payment method required)  
- ✅ Use partial credits + payment method for larger amounts
- ✅ Automatically receive $10 referral bonuses

## How It Works

### Request Creation
- **Free**: Request creation currently has no fees
- **Credits not required**: Users can create requests without credits or payment methods

### Request Acceptance (Both Users Pay $5)
1. **Trucker with $10 credits**: ✅ Can accept without payment method
2. **Provider with $5 credits**: ✅ Can accept without payment method  
3. **User with $3 credits**: Uses $3 credits + $2 from payment method
4. **User with $0 credits**: Uses payment method for full $5

### Credit Sources
- **Referral bonus**: Both referrer and referee get $10
- **Refunds**: Automatic credit refunds for failed transactions
- **Manual credits**: Can be added by admin

## Usage Examples

```typescript
// Check if user can afford an action
const { canUserAffordPayment, getUserPaymentStatus } = require('./utils/creditOperations');

// Check affordability for $5 acceptance fee
const affordability = await canUserAffordPayment(userId, 5.0);
console.log('Can afford:', affordability.canAfford);
console.log('Has sufficient credits:', affordability.hasSufficientCredits);
console.log('Needs payment method:', !affordability.hasSufficientCredits);

// Get user-friendly status message
const status = await getUserPaymentStatus(userId, 5.0, 'accept this request');
console.log(status.message);
// Output examples:
// "You can accept this request using your $10.00 credit balance."
// "You'll use $3.00 credits + $2.00 from your payment method."
// "You need $5.00 to accept this request. Please add credits or a payment method."
```

## Database Changes Applied
1. **Fixed RLS policies** for referrals table
2. **Created referral bonus function** that awards $10 to both users
3. **Updated credit operations** to use `users.credits` column
4. **Added transaction tracking** in `credit_transactions` table
5. **Created credit-first payment logic** in stored procedures

## User Experience Improvements
- ✅ No forced payment method setup if credits are sufficient
- ✅ Clear messaging about payment sources (credits vs card)
- ✅ Automatic referral code generation and bonus processing  
- ✅ Seamless fallback to payment methods when needed
- ✅ Transaction history tracking for all credit movements

## Testing the System
1. **Run the SQL fix**: Execute `fix_referral_rls.sql` in Supabase
2. **Sign up with referral**: Both users should get $10 credits
3. **Accept requests**: Users with $10+ credits don't need payment methods
4. **Check credit balance**: Should show updated amounts in UI
5. **Verify transactions**: Check `credit_transactions` table for audit trail