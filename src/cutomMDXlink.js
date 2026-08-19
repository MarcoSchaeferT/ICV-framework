'use client'; // This is a client component
import { Link } from "@/i18n/routing";

/**
 * Renders locale-aware internal MDX links, smooth-scrolling anchors, and normal external anchors.
 *
 * @param {{href: string} & Record<string, unknown>} props - Link destination and forwarded anchor properties.
 * @returns {import('react').ReactElement} Link element appropriate for the destination type.
 *
 * @remarks
 * Hash links first target the dedicated `scrollRefx` documentation container so section navigation does not scroll the
 * complete dashboard shell.
 */
const CustomMDXLink = ({ href, ...props }) => {



  const handleScroll = (e) => {
    // 1. Prevent the default browser behavior
    e.preventDefault();
    e.stopPropagation();

    // 2. Get the target element's id from the href
    const targetId = href.replace(/.*#/, "");
    const elem = document.getElementById(targetId);

    const scrollRefxDiv = document.getElementById("scrollRefx");

    // 3. Scroll to the element smoothly
    if (elem && scrollRefxDiv) {
      scrollRefxDiv.scrollTo({
        top: "" + elem.offsetTop - 180, // Adjust offset as needed
        behavior: 'smooth'
      });
    } else {
      elem.scrollOffsetTop = "20px";
      elem?.scrollIntoView({
        behavior: 'smooth'
      });
    }
  };

  // Check if the link is an internal hash link
  if (href.startsWith('#')) {
    return (
      <a
        style={{
          color: "#0070f3",
          textDecoration: "none",
          transition: "background 0.2s, color 0.2s",
        }}
        href={href}
        {...props}
        onClick={handleScroll}
        onMouseOver={e => e.currentTarget.style.background = "#e0e7ff"}
        onMouseOut={e => e.currentTarget.style.background = ""}
      />
    );
  }

  const isInternal = href && (href.startsWith('/') || href.startsWith('.'));

  if (isInternal) {
    // Use the i18n-aware Link for internal navigation
    return <Link href={href} {...props} />;
  } else {

    // For all other links, use a regular anchor tag
    return <a style={{ color: "#0070f3" }} href={href} {...props} onMouseOver={e => e.currentTarget.style.background = "#e0e7ff"}
      onMouseOut={e => e.currentTarget.style.background = ""} />;
  }
};

/** Default export for locale-aware links inside compiled MDX. */
export default CustomMDXLink;
