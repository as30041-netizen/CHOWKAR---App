import React from 'react';

// Helmet is temporarily disabled - this component will be inactive in dev
// import { Helmet } from 'react-helmet-async';

interface SEOProps {
    title: string;
    description: string;
    image?: string;
    url?: string;
    type?: string;
}

export const SEO: React.FC<SEOProps> = ({
    title,
    description,
    image = 'https://chowkar.in/og-image.png', // Placeholder
    url = 'https://chowkar.in',
    type = 'website'
}) => {
    const siteTitle = `${title} | CHOWKAR`;

    // NOTE: Helmet is temporarily disabled to fix DOM manipulation errors in dev
    // This component will be inactive until HelmetProvider is re-enabled
    // For production builds, uncomment the Helmet import and this return statement

    /* 
    return (
        <Helmet>
            {/* Standard Metrics *\/}
            <title>{siteTitle}</title>
            <meta name="description" content={description} />
            <link rel="canonical" href={url} />

            {/* Open Graph / Facebook *\/}
            <meta property="og:type" content={type} />
            <meta property="og:url" content={url} />
            <meta property="og:title" content={siteTitle} />
            <meta property="og:description" content={description} />
            <meta property="og:image" content={image} />

            {/* Twitter *\/}
            <meta property="twitter:card" content="summary_large_image" />
            <meta property="twitter:url" content={url} />
            <meta property="twitter:title" content={siteTitle} />
            <meta property="twitter:description" content={description} />
            <meta property="twitter:image" content={image} />

            {/* JSON-LD Structured Data for Local Business/Organization *\/}
            <script type="application/ld+json">
                {JSON.stringify({
                    "@context": "https://schema.org",
                    "@type": "Organization",
                    "name": "CHOWKAR",
                    "url": "https://chowkar.in",
                    "logo": "https://chowkar.in/logo.png",
                    "description": "Connecting rural India with local work and hiring opportunities.",
                    "sameAs": [
                        "https://facebook.com/chowkar",
                        "https://twitter.com/chowkar"
                    ]
                })}
            </script>
        </Helmet>
    );
    */

    return null; // Component disabled for dev
};

