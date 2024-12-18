// List of EZTV mirrors
var eztvMirrors = [
    "https://eztvx.to",
    "https://eztv1.xyz",
    "https://eztv.wf",
    "https://eztf.tf",
    "https://eztv.yt"
];

// Index to keep track of the current mirror
var currentMirrorIndex = 0;

// Function to get the next mirror in the list
function getNextEZTVMirror() {
    var mirror = eztvMirrors[currentMirrorIndex];
    currentMirrorIndex = (currentMirrorIndex + 1) % eztvMirrors.length;
    return mirror;
}

// Function to make an HTTP request with retries
function makeHttpRequestWithRetries(url) {
    var retries = 0;
    var maxRetries = 3;
    var response = null;

    while (retries < maxRetries) {
        try {
            response = http.request(url);
            if (response) {
                return response;
            }
        } catch (err) {
            console.log(`EZTV | Request failed on attempt ${retries + 1}: ${err.message}`);
        }

        retries++;
        // Switch to the next mirror on failure
        if (retries < maxRetries) {
            var nextMirror = getNextEZTVMirror();
            console.log(`EZTV | Retrying with mirror: ${nextMirror}`);
        }
    }

    // If all attempts failed, log an error
    console.log("EZTV | All request attempts failed. Returning empty result.");
    return null;
}

// Main script
page.loading = true;

var relevantTitlePartMatch = title.match(/\s(S\d{2}E\d{2})/i);

if (relevantTitlePartMatch) {
    var relevantTitlePart = relevantTitlePartMatch[1]
        .trim()
        .toLowerCase();

    console.log('EZTV | Relevant title part: ' + relevantTitlePart);
} else {
    console.log('EZTV | Movie detected, skipping...');
    return [];
}

// Use the current mirror for the search URL
var searchUrl = getNextEZTVMirror() + "/search/" + encodeURIComponent(title);
var results = [];
var httpResponse = makeHttpRequestWithRetries(searchUrl);

if (!httpResponse) {
    page.loading = false;
    return [];
}

try {
    var searchPage = html.parse(httpResponse);
    var tbodyElement = searchPage.root.getElementByTagName('tbody')[4];
    if (!tbodyElement) return [];
    var torrents = tbodyElement.getElementByTagName('tr');
    if (torrents.length === 0) return [];
    for (var i = 2; i < torrents.length; i++) {
        var torrent = torrents[i];
        try {
            if (!torrent) continue;
            var titleElements = torrent.getElementByTagName('td');
            var titleElement = titleElements[1];
            if (service.H265Filter && /[xXhH]265/i.test(titleElement.textContent)) continue;
            if (!titleElement) continue;
            var titleForCheck = titleElement.textContent.trim().toLowerCase().replace(/\./g, ' ').replace(/[\-:]/g, '');
            if (titleForCheck.indexOf(relevantTitlePart) === -1) continue;

            var seederElement = titleElements[titleElements.length - 1];
            if (!seederElement) continue;
            var seederCount = parseInt(seederElement.textContent.trim().replace(',', ''));
            if (seederCount === 0) continue;

            var linkElement = titleElement.getElementByTagName('a')[0];
            var torrentPageLink = linkElement.attributes.getNamedItem('href').value;
            if (!torrentPageLink) continue;

            // Fetch torrent page using the same mirror as the search
            var torrentPageResponse = makeHttpRequestWithRetries(getNextEZTVMirror() + torrentPageLink);
            if (!torrentPageResponse) continue;

            var htmlString = torrentPageResponse.toString();
            var magnetLinkMatch = htmlString.match(/href="(magnet:[^"]+)"/);
            if (!magnetLinkMatch || !magnetLinkMatch[1]) continue;
            var magnetLink = magnetLinkMatch[1];

            var quality = "Unknown";
            if (/1080p/i.test(titleElement.textContent)) quality = "1080p";
            if (/720p/i.test(titleElement.textContent)) quality = "720p";
            if (/XviD/i.test(titleElement.textContent)) quality = "480p";
            if (!quality) continue;

            var item = magnetLink + " - " + quality + " - " + seederCount;
            results.push(item);
        } catch (error) {
            console.log("EZTV | Error processing torrent: " + error.message);
            continue;
        }
    }
    page.loading = false;
    return results;
} catch (err) {
    console.log("EZTV | Error parsing search page: " + err.message);
    page.loading = false;
    return [];
}
