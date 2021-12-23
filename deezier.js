// ==UserScript==
// @name        Deezier
// @namespace   Violentmonkey Scripts
// @match       https://www.deezer.*/*
// @grant       none
// @version     1.0
// @author      -
// @description Make Deezer better enhancing it with new features
// ==/UserScript==

const ID_LIBRARY_ELMT = 'deezier-library';
const ID_SCROLL_MONITOR_ELMT = 'deezier-scrollelmt';

class Util {

  static simplifyString(str) {
      // "Les stations balnéaires (version acoustique) [remix]" -> "lesstationsbalnaires"
      return str.replace(/[\[("].*[\])"]|\W/g, '').toLowerCase();
  }

  static idFromHref(elmt) {
    // Isolate the part after last slash '/' of the href URL for the given element
    if (!elmt) { return console.error("Tried to retrieve id from href of an undefined element") }
    const href = elmt.getAttribute("href") || '';
    return href.split('/').pop() || null;
  }

}

class ElementBuilder {
  /* Create DOM elements */

  static createElement(name, properties={}) {
    const { id, classes, inner, innerHtml, attributes={}, style={}, children=[] } = properties;
    var elmt = document.createElement(name);
    if (id) { elmt.id = id; }
    if (classes) { elmt.className = classes; }
    if (inner) { elmt.innerText = inner; }
    if (innerHtml) { elmt.innerHTML = innerHtml; }
    Object.keys(attributes).map(k => { elmt.setAttribute(k, attributes[k]) });
    Object.assign(elmt.style, style);
    children.map(child => elmt.appendChild(child));
    return elmt;
  }

  static createInPlaylistToken(inPlaylists) {
    // Create a little visual marker meaning 'already present in a playlist'
    var tokenContent = this.createElement('div',{
      classes: "explicit outline small",
      inner: inPlaylists.length == 1 ? 'V' : inPlaylists.length,
      style: {color: 'green', 'border-color': 'green'}
    });
    return this.createElement('div', {
      classes: "datagrid-cell cell-explicit-small deezier-token",
      attributes: {title: inPlaylists.join('\n')},
      children: [tokenContent]
    });
  }

  static createBtnDetectInPlaylistTracks() {
    // The button to trigger the adding of tokens
    var btnDetectInPlaylistTracks = this.createElement("button", {
      inner: "Detect Added Tracks",
      style: { padding: '5px', border: '1px solid', margin: '5px', 'margin-left': '20px'}
    });
    btnDetectInPlaylistTracks.addEventListener('click', () =>
                                               DeezierArea.getInstance().appendInPlaylistTokens());
    return btnDetectInPlaylistTracks;
  }

  static createSearchbar() {
    // A searchbar that will determines the content displayed in the list below
    var glass = this.createElement('div', {
      inner: "🔎",
      style: {float: 'left', margin: '2px 8px 1px 2px'}
    });
    var searchField = this.createElement('input', {
      attributes: {placeholder: "Search in playlists ...", type: "text"},
      style : {'border-style': 'none', 'background-color': '#191922', 'color': '#a5a5ae'}
    });
    var searchBar = this.createElement('div', {
      style: {border: '1px solid', margin:'20px 30px 5px 5px'},
      children: [glass, searchField]}
    );

    searchField.addEventListener("keyup", e => {
      const tomatch = e.target.value;
      if (tomatch.length < 3) {
        if (tomatch.length == 0) {
          DeezierArea.getInstance().setLibraryViewPlaylists();
        }
        return; // TODO If comes back to 0 reset view to get rid of research
      }
      const matches = DeezierArea.getInstance().searchInLibrary(tomatch);
      DeezierArea.getInstance().setLibraryViewSearchResults(matches);
    });
    return searchBar;
  }

  static createLibraryList() {
    // The frame where the list elements will live
    var list = this.createElement('div', {
      id: ID_LIBRARY_ELMT,
      style: {
        height: '250px',
        width: '200px',
        'overflow-y': 'scroll',
        border: '1px #aabbcc solid',
        padding: '10px',
        'margin-left': '5px'
	    }
    });
    return list;
  }

  static createLibraryListElmts() {
    // Build a list with created elements from all playlists in library
    var elmts = [];
    for (let [pId, playlist] of DeezierArea.getInstance().getLibrary()) {
      var playlistLinkElmt = this.createElement('a', {
        inner: `${playlist.title} (${playlist.length})`,
        attributes: {href: playlist.url}
      });
      elmts.push(this.createElement('div', {
        children: [playlistLinkElmt]
      }));
    }
    return elmts;
  }

  static createLibrarySearchResultsElmts(searchResults) {
    var elmts = [];
    var lib = DeezierArea.getInstance().getLibrary();
    Object.entries(searchResults).map(([pId, results]) => {
      var playlist = lib.getPlaylist(pId);
      var children = [];
      // Name of playlist we fond results in
      children.push(this.createElement('a', {
        innerHtml:`<b>[   ${playlist.title} (${results.title.length + results.artist.length})   ]</b>`,
        attributes: {href: playlist.url}
      }));
      // Elements in first serie under playlist name are matches on the song title
      results.title.map((track, i, {length}) => {
        children.push(this.createElement('br'));
        var branchStyle = i == length-1 ? (results.artist.length ? '┡' : '┗') : '┣';
        children.push(this.createElement('a', {
          innerHtml: `  ${branchStyle} <i><b>${track.title}</b></i> - ${track.artist_name}`,
          attributes: {href: track.url},
          style: {'white-space': 'nowrap'}
        }));
      });
      // Elements in second serie under playlist name are matches on the artist name
      results.artist.map((track, i, {length}) => {
        children.push(this.createElement('br'));
        var branchStyle = i == length-1 ? '┗' : '┣';
        children.push(this.createElement('a', {
          innerHtml: `  ${branchStyle} <i><b>${track.title}</b></i> - ${track.artist_name}`,
          attributes: {href: track.url},
          style: {'white-space': 'nowrap'}
        }));
      });
      elmts.push(this.createElement('div', {
        children: children
      }));
    });
    return elmts;
  }

  static createDeezierPanelArea() {
    // The global panel where Deezier's components live
    var area = document.createElement("div");
    area.appendChild(ElementBuilder.createBtnDetectInPlaylistTracks());
    area.appendChild(ElementBuilder.createSearchbar());
    area.appendChild(ElementBuilder.createLibraryList());
    return area;
  }
}


class ElementFinder {
  /* Find DOM elements */

  static OBFUSCATED = {
    container_tracks: 'YrLz6',
    track_toplvl: 'JoTQr',
    track: 'ZLI1L',
    album: '_10fIC',
    track_title: '_2tIhH',
    track_title_only: '.BT3T6,._2QglM,._3cxEI'  // track_title can contain explicit 'E' token or InPlaylist 'V' token + special case track unavailable
  };

  static getProfileId() {
    // Discover the user id by looking at current page
    var l = document.getElementsByClassName("sidebar-nav-link is-main");
    for (let e of l) {
      var res = e.href.match(/.*profile\/(\d+)/);
      if (res) { return res[1] }
    }
  }

  static getSidebar() {
    // Deezer original left sidebar, present in all views
    return document.getElementsByClassName("nano-content")[0];
  }

  static getPlayer() {
    // The player element, expected to be always present at page bottom
    return document.getElementById("page_player");
  }

  static getCurrentTrackInPlayer() {
    // The track currently played in the player and info about it (cannot get track id directly)
    const player = this.getPlayer();
    if (!player) { return null; }
    const trackElmt = player.getElementsByClassName("track-title")[0];
    if (!trackElmt) { return null; }
    const [titleElmt, artistElmt] = trackElmt.getElementsByClassName("track-link");
    if (!titleElmt || !artistElmt) { return null; }
    return {
      track: trackElmt,
      artist_id: Util.idFromHref(artistElmt),
      artist_name: artistElmt.innerText,
      album_id: Util.idFromHref(titleElmt),  // clicking on the title redirects to album it's in actually
      title: titleElmt.innerText
    }
  }

  static getTracksInPage() {
    // Build an array of tracks present in current page (beware Deezer adjust it dynamically when scrolling)
    var tracks = document.getElementsByClassName("datagrid-row song");
    if (!tracks.length) {
      tracks = document.getElementsByClassName(this.OBFUSCATED.track);
    }
    return tracks;
  }

  static getTrackIdFromElement(trackElement) {
    var titleElmts = trackElement.getElementsByClassName("datagrid-label-main title");
    if (!titleElmts.length) {
      return null;
    }
    var urlToParse = titleElmts[0].getAttribute('href');
    return parseInt(urlToParse.substr(urlToParse.lastIndexOf('/')+1));
  }

  static getTrackInfosFromElement(trackElement) {
    const titleElmt = trackElement.getElementsByClassName(this.OBFUSCATED.track_title)[0];
    const albumElmt = trackElement.getElementsByClassName(this.OBFUSCATED.album)[0];
    const artistElmt = albumElmt.previousSibling;
    return {
      title: titleElmt.querySelector(this.OBFUSCATED.track_title_only).innerText, title_elmt: titleElmt,
      album_name: albumElmt.innerText, album_id: albumElmt.firstElementChild.firstElementChild.getAttribute('href').split('/').pop(),
      artist_name: artistElmt.innerText, artist_id: artistElmt.firstElementChild.firstElementChild.getAttribute('href').split('/').pop()
    };
  }

  static getElmtToMonitorPage() {
    // Element whose class is passed temporarily to 'opened' every time user arrive to a new view
    return document.getElementById("page_loader");
  }

  static getElmtToMonitorScrolling() {
    var elmtToMonitor, isObfuscated;
    const datagridElmt = document.getElementsByClassName("datagrid");
    if (datagridElmt.length) {
      const parent = datagridElmt[0];
      if (parent.childNodes.length <= 1) { return null }
      elmtToMonitor = parent.childNodes[1];
      isObfuscated = false;
    } else {  // Likely we are in obfuscated case
      const trackContainer = document.getElementsByClassName(this.OBFUSCATED.container_tracks);
      if (!trackContainer.length) { return null }
      elmtToMonitor = trackContainer[0];
      isObfuscated = true;
    }
    elmtToMonitor.id = ID_SCROLL_MONITOR_ELMT;
    return [elmtToMonitor, isObfuscated];
  }

}


class DOM_Monitor {
  /* Manage observers on DOM elements */

  static SCROLLING_OBS = 'scrolling';
  static PAGE_OBS = 'pageloading';

  constructor() {
    this.observers = {};
  }

  createObserver(name, domElmt, callback, options={}) {
    options = Object.assign( { attributes: true, childList: false }, options);
    if (this.observers[name] !== undefined) {
      console.log("Disconnect listening DOM observer", name, this.observers[name]);
      this.observers[name].disconnect();
    }
    this.observers[name] = new MutationObserver(callback);
    this.observers[name].observe(domElmt, options);
    console.log("Created a new listening DOM observer named", name, this.observers);
  }

  createPageChangeObserver() {
    const elmtToMonitor = ElementFinder.getElmtToMonitorPage();
    if (elmtToMonitor == null) {
      console.error("Didn't find the DOM element page_loader to monitor page loading...");
      return false;
    }
    const thisForCallback = this;
    function cbPageChanged(mutationsList) {
      mutationsList.forEach(mutation => {
        if (mutation.type === "attributes" && mutation.attributeName === "class") {
          if (!mutation.target.classList.contains("opened")) {  // process when state is flipped back from opened
            function newScrollingObs() {
              if (!thisForCallback.createScrollingObserver()) {
                console.log("New page view loaded but no element to monitor scrolling found in");
              }
            }
            // Let the time for DOM to be filled in with components
            setTimeout(newScrollingObs, 500);
          }
        }
      });
    }
    this.createObserver(DOM_Monitor.PAGE_OBS, elmtToMonitor, cbPageChanged);
    return true;
  }

  createScrollingObserver() {
    const scrollElmtFound = ElementFinder.getElmtToMonitorScrolling();
    if (scrollElmtFound === null) { return false }
    var [elmtToMonitor, isObfuscated] = scrollElmtFound;
    if (elmtToMonitor == null) { return false }
    function cbScrolling(mutationsList) {
      var newTrackAdded = false;
      for(var mutation of mutationsList) {
        if (mutation.type == 'childList') {
          for (var n of mutation.addedNodes) {
            if (n.className === ElementFinder.OBFUSCATED.track_toplvl) {
              newTrackAdded = true;
              break;
            }
          }
        }
      }
      if (newTrackAdded) { DeezierArea.getInstance().appendInPlaylistTokens(); }
    };
    var options = isObfuscated ? { childList: true, subtree: true, attributes: false } : { };
    this.createObserver(DOM_Monitor.SCROLLING_OBS, elmtToMonitor, cbScrolling, options);
    return true;
  }

}


class MusicLibrary {
  /* For an user, maintain an index of his personal playlists and fill the tracks listed in */

  constructor(profileId) {
    this.profileId = profileId;
    this.playlists = {};
    this.artists = {};
  }

  async computePlaylists() {
    // Fill the inner playlists object with metadata from the user playlists (not the tracks in yet)
    // The tracks field has to be filled afterwards calling fetchTracks()
    var pList = await this.fetchPlaylists();
    console.log("Fetched", pList.length, "playlists");
    pList.map(p => {
      this.playlists[p.id] = {
        url: p.url,
        title: p.title,
        length: p.length,
        creator: p.creator,
        tracks: {},  // <- will be filled once tracks fetched as well
        url_tracks: p.url_tracks,
        url_picture: p.url_picture,
        time_lastmodif: p.time_lastmodif
      };
    });
  }

  async computeTracks(playlistIds=[]) {
    // For each playlist in the library or given list, fetch the tracks in it, create an object indexed by track ids and
    // references this object in the property this.playlists.playlistId.tracks
    playlistIds = playlistIds.length > 0 ? playlistIds : Object.keys(this.playlists);
    for (let p of playlistIds) {
      var trackList = await this.fetchTracks(p);
      trackList.forEach(t => {
        this.playlists[p]['tracks'][t.track_id] = t;
        const artist = this.addArtist(t.artist_id, t.artist_name);
        const album = this.addAlbumToArtist(t.artist_id, t.album_id, t.album_name);
        const track = this.addTrackToArtistAlbum(t.artist_id, t.album_id, t.track_id, t.title, p);

        if (!track['inPlaylists'].includes(p)) {
          track['inPlaylists'].push(p);
        }
      });
    }
  }

  async fetchPlaylists() {
    // Get URIs list of all personal playlists from the given user, where a playlist is an object gathering useful fields about it
    const response = await fetch(`https://api.deezer.com/user/${this.profileId}/playlists&limit=1000`);
    const playlists = await response.json();
    return playlists.data.map(p => ({
      id: p.id,
      url: p.link,
      title: p.title,
      length: p.nb_tracks,
      creator: p.creator.id,
      url_tracks: p.tracklist,
      url_picture: p.picture,
      time_lastmodif: p.time_mod
    }));
  }

  async fetchTracks(playlistId) {
    const response = await fetch(`${this.playlists[playlistId].url_tracks}&limit=1000`);
    const tracks = await response.json();
    return tracks.data.map(t => ({
      track_id : t.id,
      title: t.title,
      url: t.link,
      artist_id: t.artist.id,
      artist_name: t.artist.name,
      artist_url: t.artist.link,
      album_id: t.album.id,
      album_name: t.album.title,
      album_url: t.album.tracklist
    }));
  }

  [Symbol.iterator]() {
    function orderPlaylists([idA, plA], [idB, plB]) {
      return plA.time_lastmodif < plB.time_lastmodif;
    }
    return Object.entries(this.playlists).sort(orderPlaylists)[Symbol.iterator]();
  }

  addArtist(artistId, artistName) {
    const currArtist = this.artists[artistId];
    if (currArtist) { return currArtist }
    const newArtist = {
      artist_name: artistName,
      albums: { }
    };
    this.artists[artistId] = newArtist;
    return newArtist;
  }

  addAlbumToArtist(artistId, albumId, albumName) {
    const currAlbum = this.artists[artistId]['albums'][albumId];
    if (currAlbum) { return currAlbum }
    const newAlbum = {
      album_name: albumName,
      album_tracks: { }
    };
    this.artists[artistId]['albums'][albumId] = newAlbum;
    return newAlbum;
  }

  addTrackToArtistAlbum(artistId, albumId, trackId, trackName, inPlaylist) {
    const currTrack = this.artists[artistId]['albums'][albumId]['album_tracks'][trackId];
    if (currTrack) { return currTrack }
    const newTrack = {
      title: trackName,
      inPlaylists: [inPlaylist]
    };
    this.artists[artistId]['albums'][albumId]['album_tracks'][trackId] = newTrack;
    return newTrack;
  }


  getPlaylist(id) {
    return this.playlists[id] || null;
  }

  getPlaylistsNameFromId(playlistIds, keepOmitted=false) {
    if (!keepOmitted) {
      playlistIds = playlistIds.filter(pId => this.isPlaylistListable(pId));
    }
    return playlistIds.map(pId => this.getPlaylist(pId).title);
  }

  getTracksInPlaylist(playlistId, onlyTrackIds=true) {
    if (this.playlists[playlistId] !== undefined) {
      return Object.entries(this.playlists[playlistId].tracks).map(([tId, track]) => onlyTrackIds ? tId : track);
    }
    return []
  }

  getAllTracks(onlyTrackIds=true) {
    var allTracks = [];
    Object.keys(this.playlists).map(pId => allTracks.push(...this.getTracksInPlaylist(pId, onlyTrackIds)));
    return allTracks;
  }

  isPlaylistListable(pId, lovedTracksPlaylist=false, otherUserPlaylists=false) {
    // When we list some playlists, we want to omit some undesired specific ones
    const playlist = this.getPlaylist(pId);
    if (playlist === null) { return false }
    const isOwnUserPlaylist = (playlist.creator == ElementFinder.getProfileId());
    if (otherUserPlaylists || isOwnUserPlaylist) {  // Consider only user's playlist if not specified
      if (lovedTracksPlaylist || playlist.title != "Loved Tracks" || !isOwnUserPlaylist) {
        return true;
      }
    }
    return false;
  }

  getPlaylistsContainingTrack(trackId, lovedTracksPlaylist=false, otherUserPlaylists=false) {
    var inPlaylists = [];
    Object.entries(this.playlists).map(([pId, playlist]) => {
      if (this.isPlaylistListable(pId, lovedTracksPlaylist, otherUserPlaylists)) {
        if (this.getTracksInPlaylist(pId).includes(String(trackId))) {
          inPlaylists.push(playlist.title);
        }
      }
    });
    return inPlaylists;
  }

  searchMathingTracks(tomatch) {
    // From the playlists, retrieve all tracks matching a pattern (used in track research). Returns an object
    // indexed by playlist id in which a match is found, either on the track title or the artist (separated in 2 arrays)
    const re = RegExp(tomatch, 'i');
    const matchedPlaylists = {};
    Object.entries(this.playlists).map(([pId, playlist]) => {
      var matches = { title: [], artist: [] };
      Object.values(playlist.tracks).map(track => {
        var matchCategory = null;
        if (re.test(track.title) && !matches.title.filter(m => m.id === track.track_id).length) {
          matchCategory = matches.title;
        }
        if (re.test(track.artist_name) && !matches.artist.filter(m => m.id === track.track_id).length) {
          matchCategory = matches.artist;
        }
        matchCategory !== null && matchCategory.push(Object.assign({}, track));
      });
      if (matches.title.length || matches.artist.length) {
        matchedPlaylists[pId] = matches;
      }
    });
    return matchedPlaylists;
  }

  getArtist(id) {
    return this.artists[id] || null;
  }

  getArtistIds() {
    return Object.keys(this.artists);
  }

  getAlbumsFromArtist(artistId) {
    const artist = this.getArtist(artistId);
    if (!artist) { return null }
    return artist['albums'];
  }

  getAlbumTracksFromArtist(artistId, albumId, albumName=null) {
    // From the known artists, return the album object if it exists by id, or the id of a matching album title if
    // the id doesn't exist anymore (it was returned by Deezer API which is inconsistent)
    const artist = this.getArtist(artistId);
    if (!artist) { return null }
    if (!artist['albums'][albumId]) {
      // Try to get best match on title because Deezer fucked up and returned obsolete id
      var matchingAlbum = null;
      Object.entries(artist['albums']).map(([albumId, album]) => {
        if (album.album_name === albumName) {
          matchingAlbum = albumId;
        }
      });
      return matchingAlbum;
    }
    return artist['albums'][albumId]['album_tracks'] || null;
  }

  getSimilarTracksFromArtist(artistId) {
    // For an artist, get similar tracks by name. Return an object indexed by canonical name with as value an array
    // of tracks matching this canonical name, thus to consider as similar tracks
    const albums = this.getAlbumsFromArtist(artistId);
    if (!albums) { return null; }
    const similars = {};  // indexed by a canonical representation of track's name
    Object.values(albums).map(album => {
      Object.entries(album.album_tracks).map(([trackId, track]) => {
        var simplified = Util.simplifyString(track.title);
        var newEntry = {track_id: trackId, title: track.title, inPlaylists: track.inPlaylists};
        if (similars[simplified] === undefined) {
          similars[simplified] = [newEntry];
        } else {
          similars[simplified].push(newEntry);
        }
      });
    });
    return Object.fromEntries(Object.entries(similars).filter(([_, arrSimTracks]) => arrSimTracks.length > 1));
  }

  getSimilarTracksGroupedByArtist(artistIds=[]) {
    var artistIds = artistIds.length ? artistIds : this.getArtistIds();
    const simTracksByArtist = {};
    artistIds.map(artistId => {
      const simTracks = this.getSimilarTracksFromArtist(artistId);
      if (Object.keys(simTracks).length) {
        simTracksByArtist[artistId] = Object.values(simTracks);
      }
    });
    return simTracksByArtist;
  }

  getPlaylistsMatchingTrackFromArtist(artistId, trackTitle, albumId=null, albumName=null, onlySimilarTracks=false) {
    // Sometimes we don't have the track id itself (only title), so we use known artist/album stuff to determine if
    // the track is present in the library. Tries to perform the best, sometimes album id doesn't exist anymore but actually the
    // album name matches (likely Deezer API returns obsolete info). Returns an array of playlist names the track is in.
    const inPlaylists = [];
    if (albumId) {
      var albumTracks = this.getAlbumTracksFromArtist(artistId, albumId, albumName);
      if (typeof albumTracks === "string") {
        // The album id we had in artist library was likely obsolete, but got another album id by matching album name
        const matchingAlbumId = albumTracks;
        albumTracks = this.getAlbumTracksFromArtist(artistId, matchingAlbumId);
        console.log("Was unable to get album", albumId, albumName, "but found a match by name", matchingAlbumId, "where track", trackTitle, "is part of", albumTracks);
      } else if (albumTracks === null) {
        console.error("While looking for track matching", trackTitle, ", didn't find any tracks in album", albumId, "of artist", artistId, this.getArtist(artistId));
        albumTracks = {};
      }
      Object.entries(albumTracks).map(([id, albumTrack]) => {
        if (onlySimilarTracks) {
          if (Util.stringsSimilar(trackTitle, albumTrack.title)) {
            inPlaylists.push(Object.assign(albumTrack, { id: id }));
          }
        } else if (albumTrack.title === trackTitle) {
          inPlaylists.push(... albumTrack.inPlaylists);
        }
      });
      return [... new Set(inPlaylists)];
    } else {  // Will walk through all known albums of the given artist
      return Object.keys(this.getAlbumsFromArtist(artistId)).foreach(albumId => {
        inPlaylists.push(... this.getMatchingTrackFromArtist(artistId, trackTitle, albumId, onlySimilarTracks));
      });
    }
    return inPlaylists;
  }


  display() {
    console.log("Music library for user", this.profileId, '\nPlaylists:', this.playlists, '\nArtists', this.artists);
  }

}


class DeezierArea {
  /* The place where all the stuff Deezier is working on is gathered, mapping in DOM as an area in sidebar */

  constructor(library) {
    if(!DeezierArea._instance) {
      DeezierArea._instance = this;
    }
    this.library = library;
    this.libraryViewElmt = null;
    this.domObserver = new DOM_Monitor();
    this.panelArea = null;
    return DeezierArea._instance;
  }

  static getInstance() {
    return this._instance;
  }

  injectInPage() {
    // Inject the actual DOM area panel in the left side bar of Deezer interface
    this.panelArea = ElementBuilder.createDeezierPanelArea();
    ElementFinder.getSidebar().appendChild(this.panelArea);
    this.libraryViewElmt = document.getElementById(ID_LIBRARY_ELMT);
    this.setLibraryViewPlaylists();
    // Setup observers on DOM elements
    this.domObserver.createScrollingObserver();  // don't wait until we load a new page view to try it
    this.domObserver.createPageChangeObserver();
  }

  appendInPlaylistTokens() {
    // Add a 'V' token in the frontend beside every song already present in a user's playlist
    // 1. Potential tracks in current page view (playlist, album)
    var tracks = ElementFinder.getTracksInPage();
    console.log("Found", tracks.length, "tracks on this page !", tracks);
    // TODO : not very efficient to go through the whole library for each track >:(
    for (let track of tracks) {
      if(track && track.getAttribute('deezier-token')) {
          continue  // Song unavailable or already marked with a token
      }
      var titleElmt, inPlaylistsName = [];
      var trackId = ElementFinder.getTrackIdFromElement(track);
      if (trackId) {
        titleElmt = track.querySelector(".cell-title");
        inPlaylistsName = this.library.getPlaylistsContainingTrack(trackId);
      } else {  // Likely we are in the case classnames are obfuscated
        const trackInfos = ElementFinder.getTrackInfosFromElement(track);  // Cannot get directly track id, but we have artist/album id + name of the track
        titleElmt = trackInfos.title_elmt;
        var inPlaylistsId = this.library.getPlaylistsMatchingTrackFromArtist(trackInfos.artist_id, trackInfos.title, trackInfos.album_id, trackInfos.album_name);
        inPlaylistsName = inPlaylistsId.filter(pId => this.library.isPlaylistListable(pId)).map(pId => {
          return this.library.getPlaylist(pId).title;
        });
      }
      if (inPlaylistsName.length) {  // track is in at least one playlist
        titleElmt.parentElement.insertBefore(ElementBuilder.createInPlaylistToken(inPlaylistsName), titleElmt);
        track.setAttribute('deezier-token', 1);
      }
    }
    // 2. The current track in the player at the bottom
    const currTrackInfo = ElementFinder.getCurrentTrackInPlayer();
    if (!currTrackInfo) { return null; }
    var titleElmt = currTrackInfo.track;
    if (titleElmt.getAttribute('deezier-token')) {
      titleElmt.parentNode.getElementsByClassName("deezier-token")[0].remove();
    }
    var inPlaylistsId = this.library.getPlaylistsMatchingTrackFromArtist(currTrackInfo.artist_id, currTrackInfo.title, currTrackInfo.album_id);
    var inPlaylistsName = this.library.getPlaylistsNameFromId(inPlaylistsId);
    if (inPlaylistsName.length) {
      titleElmt.parentElement.insertBefore(ElementBuilder.createInPlaylistToken(inPlaylistsName), titleElmt);
      titleElmt.setAttribute('deezier-token', 1);
    }
  }

  searchInLibrary(tomatch) {
    // TODO some cache system when typing a new following letter, only look in previous result because we narrow down
    return this.library.searchMathingTracks(tomatch)
  }

  cleanLibraryView() {
    while (this.libraryViewElmt.firstChild) { this.libraryViewElmt.firstChild.remove() }
  }

  setLibraryViewPlaylists() {
    this.cleanLibraryView();
    this.libraryViewElmt.style.removeProperty('overflow-x');
    ElementBuilder.createLibraryListElmts().map(p => this.libraryViewElmt.appendChild(p));
  }

  setLibraryViewSearchResults(searchResults) {
    this.cleanLibraryView();
    this.libraryViewElmt.style['overflow-x'] = 'scroll';
    ElementBuilder.createLibrarySearchResultsElmts(searchResults).map(p => this.libraryViewElmt.appendChild(p));
  }

  getPanelArea() {
    return this.panelArea;
  }

  getLibrary() {
    return this.library;
  }

}




async function process() {
  console.log("Start Deezier process ..");
  const userId = ElementFinder.getProfileId();
  if (!userId) {
    delayStart(1000);
    return;
  }
  var lib = new MusicLibrary(userId);
  var area = new DeezierArea(lib);
  await lib.computePlaylists();
  console.log("Retrieving tracks from all playlists in library..");
  lib.computeTracks(playlistIds=[]); // No await here to avoid blocking too much time
  lib.display();
  console.log("Injecting Deezier area in left side panel..");
  area.injectInPage();
  console.log("End Deezier process ..");
  //setTimeout(() => console.log(lib.getSimilarTracksGroupedByArtist()), 15000);
}

function delayStart(delay=2000) {
  setTimeout(process, delay);
}

console.log("DEEZIER");
delayStart();

