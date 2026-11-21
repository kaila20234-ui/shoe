import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { customerApi } from './api';
import { formatNaira } from '../shared/lib/format';
import { ComplaintForm } from './complaints';

export type CustomerInfoPageKey =
  | 'contact'
  | 'shipping'
  | 'returns'
  | 'faqs'
  | 'privacy';

const pageDetails: Record<CustomerInfoPageKey, { title: string; intro: string }> = {
  contact: {
    title: 'Contact Us',
    intro: 'We’re here to help with your order, delivery, or finding the right pair.',
  },
  shipping: {
    title: 'Shipping Info',
    intro: 'Delivery availability, fees, and estimated times are based on your delivery zone.',
  },
  returns: {
    title: 'Returns & Exchanges',
    intro: 'Find out how to submit a return request and what to expect after you do.',
  },
  faqs: {
    title: 'Frequently Asked Questions',
    intro: 'Quick answers about shopping, payment, delivery, and returns.',
  },
  privacy: {
    title: 'Privacy Policy',
    intro: 'How Shoe Store collects, uses, and protects personal information.',
  },
};

function ContactDetails() {
  return (
    <>
      <div className="info-contact-grid">
        <article className="info-card">
          <span className="info-card__label">Email</span>
          <h2>Send us a message</h2>
          <a href="mailto:support@example.com">support@example.com</a>
          <p>For order questions, include your order number if you have one.</p>
        </article>
        <article className="info-card">
          <span className="info-card__label">Phone</span>
          <h2>Call our team</h2>
          <a href="tel:+23498765432">+234 987 654 32</a>
          <p>Support hours: [Add support hours]</p>
        </article>
        <p className="info-contact-note">
          The email, phone number, and support hours above are placeholders. Replace them with
          your verified customer-service details before launch.
        </p>
      </div>
      <ComplaintForm />
    </>
  );
}

function ShippingInfo() {
  const zones = useQuery({
    queryKey: ['delivery-zones'],
    queryFn: customerApi.deliveryZones,
  });
  const activeZones = zones.data?.filter((zone) => zone.isActive) ?? [];

  return (
    <>
      <section className="info-section">
        <h2>Delivery zones and estimates</h2>
        <p>
          Delivery coverage, fees, and estimated delivery times are configured by zone.
          Select your address at checkout to see the available options before placing an order.
          Estimates are not guaranteed delivery dates.
        </p>
        {zones.isLoading && <p role="status">Loading delivery information…</p>}
        {zones.isError && (
          <div className="info-notice" role="alert">
            Delivery zones could not be loaded. Please check the options again at checkout.
            <button type="button" onClick={() => { void zones.refetch(); }}>Try again</button>
          </div>
        )}
        {zones.isSuccess && activeZones.length > 0 && (
          <ul className="info-zone-list">
            {activeZones.map((zone) => (
              <li className="info-zone" key={zone.id}>
                <div>
                  <h3>{zone.name}</h3>
                  <p>{zone.states.join(', ')}</p>
                </div>
                <div className="info-zone__estimate">
                  <strong>{formatNaira(zone.fee)}</strong>
                  <span>{zone.estimatedDays}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
        {zones.isSuccess && activeZones.length === 0 && (
          <p className="info-notice">No delivery zones are currently available.</p>
        )}
      </section>
      <section className="info-section">
        <h2>Before placing your order</h2>
        <ul className="info-bullets">
          <li>Make sure your delivery address and phone number are correct.</li>
          <li>Delivery must be available for the state on your address.</li>
          <li>The applicable fee and estimate are shown before you confirm checkout.</li>
        </ul>
        <Link className="info-action-link" to="/checkout">Continue to checkout <span aria-hidden="true">→</span></Link>
      </section>
    </>
  );
}

function ReturnsInfo() {
  return (
    <>
      <section className="info-section">
        <h2>How to request a return</h2>
        <ol className="info-bullets info-bullets--numbered">
          <li>Sign in and open <Link to="/orders">My orders</Link>.</li>
          <li>Open the delivered order and choose the item and quantity you want to return.</li>
          <li>Tell us the reason and submit the request for review.</li>
        </ol>
        <p>
          Return requests can currently be submitted for delivered orders on a customer account.
          Submitting a request does not automatically approve it or issue a refund. The store
          reviews requests before making a decision.
        </p>
      </section>
      <section className="info-section">
        <h2>Refunds and exchanges</h2>
        <p>
          The website does not currently support exchanges. Refunds are handled after a return
          request is reviewed; the current system supports full-order refunds only, not partial
          refunds. No fixed return window or item-condition policy is currently published, so
          please contact us before sending an item back.
        </p>
        <Link className="info-action-link" to="/contact-us">Contact us about a return <span aria-hidden="true">→</span></Link>
      </section>
    </>
  );
}

function FrequentlyAskedQuestions() {
  return (
    <div className="info-faq-list">
      <details>
        <summary>Can I place an order without creating an account?</summary>
        <p>Yes. Guest checkout is available. You’ll be asked for contact and delivery details at checkout.</p>
      </details>
      <details>
        <summary>How do I know the delivery fee and estimated time?</summary>
        <p>Choose your delivery address and an available zone at checkout. The zone’s fee and estimated delivery time are shown before you place your order.</p>
      </details>
      <details>
        <summary>Which payment methods can I use?</summary>
        <p>Checkout currently offers online payment through Paystack and pay on delivery.</p>
      </details>
      <details>
        <summary>Where can I see my order status?</summary>
        <p>Sign in and visit <Link to="/orders">My orders</Link> to view your orders and their progress.</p>
      </details>
      <details>
        <summary>How do I request a return?</summary>
        <p>For an eligible delivered order on your customer account, open its details from My orders and submit a return request. See our <Link to="/returns-exchanges">Returns &amp; Exchanges</Link> page for details.</p>
      </details>
      <details>
        <summary>Can I exchange a shoe for another size or style?</summary>
        <p>Online exchanges are not currently available. Contact us before sending anything back.</p>
      </details>
      <details>
        <summary>How do I submit a complaint and follow up?</summary>
        <p>Use our <Link to="/complaints">Complaints</Link> page. We’ll provide a reference number; signed-in customers can follow replies in My Complaints. Guests can use the secure link if email delivery is configured, or save the access token shown after submission.</p>
      </details>
      <details>
        <summary>How do I check whether a size is available?</summary>
        <p>Open the product page and select a size. Available options are shown there; stock can change before an order is placed.</p>
      </details>
    </div>
  );
}

function PrivacyPolicy() {
  return (
    <div className="info-policy">
      <p className="info-policy__updated">Last updated: November 21, 2026</p>
      <section className="info-section">
        <h2>About this policy</h2>
        <p>
          This notice describes how Shoe Store handles information on its customer website
          in Nigeria. We aim to handle personal information in line with applicable
          Nigerian data-protection requirements.
        </p>
      </section>
      <section className="info-section">
        <h2>Information we collect</h2>
        <p>
          When you use Shoe Store, we may collect your name, email address, phone number,
          delivery address, account profile image, and information about your orders. If you
          create an account, we store account credentials in protected form. We also process
          information you provide in product reviews or return requests, and technical
          information needed to keep your session and shopping cart working. If you contact
          support, we store the complaint details and replies needed to handle your request.
        </p>
      </section>
      <section className="info-section">
        <h2>How we use information</h2>
        <ul className="info-bullets">
          <li>To manage accounts, carts, orders, delivery, returns, and customer requests.</li>
          <li>To process payments and keep order and transaction records.</li>
          <li>To send essential account and order messages, such as password reset and order status emails.</li>
          <li>To protect the store, prevent misuse, and maintain operational records.</li>
        </ul>
      </section>
      <section className="info-section">
        <h2>Payments and service providers</h2>
        <p>
          Online payments are processed through Paystack. Shoe Store records payment and
          transaction details needed to manage an order; payment card details are handled by
          the payment provider. We may use service providers to host the store and deliver
          essential emails. We do not sell personal information.
        </p>
      </section>
      <section className="info-section">
        <h2>Storage, security, and retention</h2>
        <p>
          Your browser stores an authentication token to keep you signed in. Guest cart
          details and guest payment verification details may also be stored in your browser
          session. Sign out on shared devices. We use safeguards intended to protect
          personal information, but no online service can guarantee absolute security. We
          retain information for as long as needed to provide the service, manage orders,
          resolve disputes, and meet applicable legal or operational requirements.
        </p>
      </section>
      <section className="info-section">
        <h2>Your choices and privacy requests</h2>
        <p>
          You can update some account and address information from your account settings.
          For requests to access, correct, or delete personal information, or questions about
          how it is used, contact us. We may need to retain certain order or transaction
          records where required or permitted by law.
        </p>
        <Link className="info-action-link" to="/contact-us">Contact us about privacy <span aria-hidden="true">→</span></Link>
      </section>
      <section className="info-section">
        <h2>Policy updates</h2>
        <p>
          We may update this policy as the store or its practices change. The latest version
          will be published on this page with its updated date.
        </p>
      </section>
    </div>
  );
}

export function CustomerInfoPage({ page }: { page: CustomerInfoPageKey }) {
  const details = pageDetails[page];

  return (
    <div className="storefront-page info-page">
      <nav className="info-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Home</Link><span aria-hidden="true">/</span><span>{details.title}</span>
      </nav>
      <header className="info-page__header">
        <span className="section-eyebrow">Shoe Store · Customer service</span>
        <h1>{details.title}</h1>
        <p>{details.intro}</p>
        {page === 'contact' && (
          <Link className="info-action-link" to="/complaints">Submit a complaint <span aria-hidden="true">→</span></Link>
        )}
      </header>
      {page === 'contact' && <ContactDetails />}
      {page === 'shipping' && <ShippingInfo />}
      {page === 'returns' && <ReturnsInfo />}
      {page === 'faqs' && <FrequentlyAskedQuestions />}
      {page === 'privacy' && <PrivacyPolicy />}
    </div>
  );
}
