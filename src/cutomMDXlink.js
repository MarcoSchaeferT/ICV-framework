'use client'; // This is a client component
import { Link } from "@/i18n/routing";

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

export default CustomMDXLink;