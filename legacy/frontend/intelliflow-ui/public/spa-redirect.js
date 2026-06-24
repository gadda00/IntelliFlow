// This script handles GitHub Pages SPA routing
// It must be included in the index.html file

// Check if we need to redirect
(function() {
  // Parse the URL
  var location = window.location;
  var search = location.search;
  
  // Check if we're being redirected from the 404.html page
  if (search.includes('?/')) {
    // Parse the real URL from the query string
    var redirectPath = search.substring(2); // Remove the '?/'
    var hashIndex = redirectPath.indexOf('#');
    var hash = '';
    
    // Extract hash if present
    if (hashIndex >= 0) {
      hash = redirectPath.substring(hashIndex);
      redirectPath = redirectPath.substring(0, hashIndex);
    }
    
    // Replace encoded characters
    redirectPath = redirectPath.replace(/~and~/g, '&');
    
    // Clean up the URL
    var cleanUrl = location.pathname.replace(/\/$/, '') + '/' + redirectPath + 
                  (redirectPath.includes('?') ? '&' : '?') + 
                  location.search.replace(/^\?/, '').replace(/\?\/.*$/, '') + 
                  hash;
    
    // Use history API to update the URL without reloading
    window.history.replaceState(null, null, cleanUrl);
  }
})();
