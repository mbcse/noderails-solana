import { notFound } from 'next/navigation';
import { createCheckoutSessionFromLink } from '@/lib/api';
import { PaymentLinkCheckout } from '@/components/payment-link-checkout';
import { CheckoutWeb3Provider } from '@/components/checkout-web3-provider';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function PaymentLinkPage({ params }: PageProps) {
  const { slug } = await params;

  // Create a checkout session from the payment link.
  // This is the universal entry point: payment link → checkout session → authorize.
  const sessionData = await createCheckoutSessionFromLink(slug);

  if (!sessionData) {
    notFound();
  }

  return (
    <CheckoutWeb3Provider chains={sessionData.acceptedChains ?? []}>
      <PaymentLinkCheckout link={sessionData} />
    </CheckoutWeb3Provider>
  );
}
