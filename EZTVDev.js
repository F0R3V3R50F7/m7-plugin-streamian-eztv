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

// Function to attempt an HTTP request with retries
function safeHttpRequest(url) {
    var retries = 0;
    while (retries < 3) {
        var mirror = getNextEZTVMirror();
        console.log(`EZTV | Attempting request to: ${mirror}${url}`);
        try {
            var response = http.request(mirror + url);
            if (response) {
                console.log(`EZTV | Request successful: ${mirror}${url}`);
                return response;
            }
        } catch (err) {
            console.log(`EZTV | Request failed for mirror: ${mirror}`);
        }
        retries++;
    }
    console.error("EZTV | All mirrors failed after 3 attempts.");
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

// Use safeHttpRequest for search URL
var searchUrl = "/search/" + encodeURIComponent(title);
var httpResponse = safeHttpRequest(searchUrl);
if (!httpResponse) {
    page.loading = false;
    return [];
}

var results = [];
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

            // Fetch torrent page using safeHttpRequest
            var torrentPageResponse = safeHttpRequest(torrentPageLink);
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
    console.log("EZTV | Error: " + err.message);
    page.loading = false;
    return [];
}
