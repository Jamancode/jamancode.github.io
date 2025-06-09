// Global Mocks & Simplified State
global.localStorage = {
    _data: {},
    getItem: function(key) { return this._data[key] || null; },
    setItem: function(key, value) { this._data[key] = String(value); },
    removeItem: function(key) { delete this[key]; },
    clear: function() { this._data = {}; }
};

global.document = {
    _elements: {},
    getElementById: function(id) {
        if (!this._elements[id]) {
            this._elements[id] = {
                id: id, value: '', innerHTML: '', style: { display: '' },
                options: [], checked: false, dataset: {},
                classList: { _classes: new Set(), add: function(c) { this._classes.add(c); }, remove: function(c) { this._classes.delete(c); }, contains: function(c) { return this._classes.has(c); } },
                appendChild: function() {}, setAttribute: function(k,v){ this[k]=v; }, getAttribute: function(k){ return this[k]; }
            };
        }
        return this._elements[id];
    },
    querySelectorAll: () => [],
    createElement: (type) => ({ type: type, appendChild: () => {}, setAttribute: () => {}, style: {}, innerHTML:'', value:'' }),
    body: { getAttribute: () => 'light', setAttribute: () => {} },
    documentElement: { style: { setProperty: () => {} } }
};
let mockDomElements = document._elements; // Reference for convenience

global.window = {
    L: { map:()=>({setView:()=>{},on:()=>{},removeLayer:()=>{},invalidateSize:()=>{}}), tileLayer:()=>({addTo:()=>{}}), marker:()=>({addTo:()=>({bindPopup:()=>({openPopup:()=>{}}),on:()=>{}}),remove:()=>{}}), icon:()=>{}, latLng:(lat,lng)=>[lat,lng] },
    matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }),
    PWAStrategyRouter: function() { this.execute = () => {}; this.setupSettingsInstallButton = () => {}; },
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    updateSelectedTripLocationInfo: (gewaesserId, coords) => updateSelectedTripLocationInfo(gewaesserId, coords),
    updateSelectedAngelgangGewaesserInfo: (gewaesserId, coords) => { // This is the actual app function's behavior
        const displayDiv = document.getElementById('selectedAngelgangGewaesserInfo');
        let html = '';
        if (gewaesserId) {
            html += `Gewässer: <strong>${getGewaesserName(gewaesserId)}</strong>`;
        }
        if (coords) {
            html += `${gewaesserId ? ' | ' : ''}Platz: <strong>${coords}</strong>`;
        }
        if (!html) {
             html = '<span style="color: var(--text-secondary);">Gewässer/Ort auf Karte wählen</span>';
        }
        displayDiv.innerHTML = html;
        document.getElementById('selectedGewaesserHidden').value = gewaesserId || '';
        document.getElementById('angelgangGewaesserCoordsStore').value = coords || '';
    },
    updateSelectedCatchGewaesserInfo: (gewaesserId, coords) => { // This is the actual app function's behavior
        const displayDiv = document.getElementById('selectedCatchGewaesserInfo');
        let html = '';
        if (gewaesserId) {
            html += `Gewässer: <strong>${getGewaesserName(gewaesserId)}</strong>`;
        }
        if (coords) {
            html += `${gewaesserId ? ' | ' : ''}Fangort: <strong>${coords}</strong>`;
        }
        if (!html) {
            html = '<span style="color: var(--text-secondary);">Kein Gewässer/Ort ausgewählt</span>';
        }
        displayDiv.innerHTML = html;
        document.getElementById('catchGewaesserIdStore').value = gewaesserId || '';
        document.getElementById('catchLocationCoordsStore').value = coords || '';
    }
};
global.navigator = { userAgent: "NodeTest", onLine: true};
global.alert = (message) => console.log(`ALERT: ${message}`);
global.confirm = (message) => { /*console.log(`CONFIRM: ${message}`);*/ return true; };
global.prompt = (message, def) => { /*console.log(`PROMPT: ${message} [${def}]`);*/ return def;};

// --- Application Code (Minimal Subset) ---
let gewaesser = [];
let plannedTrips = [];
let fishingTypes = [];
let equipmentCatalog = [];
let universalMapContext = null;
let universalMapTargetInputGewaesserId = null;
let universalMapTargetInputCoords = null;
let universalMapTargetDisplayCallback = null;
let selectedGewaesserForCatchMap = null;
let tempCatchLocationMarker = null;
var currentEditingTripId = null;

function getGewaesserName(id) { if (!id) return null; const g=gewaesser.find(gw=> String(gw.id) === String(id)); return g?g.name:'Unbekanntes Gewässer'; }
function updateSelectedTripLocationInfo(gewaesserId, coords) {
    const displayDiv = document.getElementById('selectedTripLocationInfo');
    const gewaesserIdInput = document.getElementById('tripGewaesserHidden');
    const coordsInput = document.getElementById('tripLocationCoordsStore');
    let html = '';
    if (gewaesserId) { const gwName = getGewaesserName(gewaesserId); html += `Gewässer: <strong>${gwName}</strong>`; }
    if (coords) { html += `${gewaesserId ? ' | ' : ''}Ort: <strong>${coords}</strong>`; }
    if (!html) { html = '<span style="color: var(--text-secondary);">Ort auf Karte wählen oder Gewässer auswählen</span>'; }
    displayDiv.innerHTML = html; gewaesserIdInput.value = gewaesserId || ''; coordsInput.value = coords || '';
    const tripGewaesserSelect = document.getElementById('tripGewaesser');
    if (gewaesserId && tripGewaesserSelect) {
        let optionExists = tripGewaesserSelect.options.some(opt => opt.value === gewaesserId);
        if (optionExists) { tripGewaesserSelect.value = gewaesserId; }
        else { tripGewaesserSelect.options.push({value: gewaesserId, text: getGewaesserName(gewaesserId) || `Gewässer ${gewaesserId}`}); tripGewaesserSelect.value = gewaesserId; }
    }
}
function openUniversalMapModal(context, targetGewaesserIdField, targetCoordsField, callbackName) { universalMapContext = context; universalMapTargetInputGewaesserId = targetGewaesserIdField; universalMapTargetInputCoords = targetCoordsField; universalMapTargetDisplayCallback = callbackName;}
function saveCatchLocationFromMap() {
    let gewaesserIdToStore = selectedGewaesserForCatchMap || null;
    let locationCoordsToStore = tempCatchLocationMarker || null;
    if (gewaesserIdToStore && !locationCoordsToStore) { const gw = gewaesser.find(g => String(g.id) === String(gewaesserIdToStore)); if (gw && gw.location) locationCoordsToStore = gw.location; }
    const newSpotNameFromInput = document.getElementById('newSpotNameInput').value.trim();
    const newGewaesserType = document.getElementById('newGewaesserType_universalMap').value;
    if (!gewaesserIdToStore && locationCoordsToStore && newSpotNameFromInput && (universalMapContext === 'selectLocationForTrip' || universalMapContext === 'selectGewasserForAngelgang' || universalMapContext === 'manageGewaesserTab')) {
        const newGewaesserData = { id: String(Date.now()), name: newSpotNameFromInput, type: newGewaesserType || 'spot', location: locationCoordsToStore, fishTypes:[], notes:'', size:'', depth:null };
        gewaesser.push(newGewaesserData); gewaesserIdToStore = newGewaesserData.id;
        const tripGewaesserSelect = document.getElementById('tripGewaesser');
        if(tripGewaesserSelect && !tripGewaesserSelect.options.some(o => o.value === gewaesserIdToStore)) { tripGewaesserSelect.options.push({value: gewaesserIdToStore, text: newGewaesserData.name}); }
    }
    if (universalMapTargetInputGewaesserId) { document.getElementById(universalMapTargetInputGewaesserId).value = gewaesserIdToStore || ''; }
    if (universalMapTargetInputCoords) { document.getElementById(universalMapTargetInputCoords).value = locationCoordsToStore || ''; }
    if (universalMapTargetDisplayCallback && typeof window[universalMapTargetDisplayCallback] === 'function') { window[universalMapTargetDisplayCallback](gewaesserIdToStore, locationCoordsToStore); }
}

function initializeTestEnvironment() {
    localStorage.clear();
    document._elements = {};
    mockDomElements = document._elements;

    gewaesser = [
        {id: "1", name: 'Test See', type: 'lake', location: '50.1,10.1'},
        {id: "2", name: 'Test Fluss', type: 'river', location: '50.2,10.2'}
    ];
    plannedTrips = [];
    fishingTypes = ["Spinnfischen", "Grundangeln", "Posenfischen", "Allgemein"];
    equipmentCatalog = [{"id":"rute_spinn_std","name":"Spinnrute Standard","category":"Spinnfischen"}];
    localStorage.setItem('gewaesser', JSON.stringify(gewaesser));
    localStorage.setItem('plannedTrips', JSON.stringify(plannedTrips));
    localStorage.setItem('fishingTypes', JSON.stringify(fishingTypes));
    localStorage.setItem('equipmentCatalog', JSON.stringify(equipmentCatalog));

    // Prime all necessary DOM element mocks by calling getElementById
    const idsToPrime = ['selectedTripLocationInfo', 'tripGewaesserHidden', 'tripLocationCoordsStore',
                        'tripGewaesser', 'tripDate', 'tripTime', 'tripTypeSelect', 'tripNotes', 'tripId',
                        'newSpotNameInput', 'newGewaesserType_universalMap',
                        'selectedAngelgangGewaesserInfo', 'selectedGewaesserHidden', 'angelgangGewaesserCoordsStore',
                        'selectedCatchGewaesserInfo', 'catchGewaesserIdStore', 'catchLocationCoordsStore'];
    idsToPrime.forEach(id => document.getElementById(id));

    const tripGewaesserSelect = document.getElementById('tripGewaesser');
    tripGewaesserSelect.options = [{value: '', text: 'Gewässer wählen...'}];
    gewaesser.forEach(g => tripGewaesserSelect.options.push({value: g.id, text: g.name}));
}

function openTripPlanningModal(dateString, tripToEditId) {
    currentEditingTripId = tripToEditId;
    document.getElementById('tripId').value = tripToEditId || '';
    document.getElementById('tripDate').value = ''; document.getElementById('tripTime').value = '';
    document.getElementById('tripTypeSelect').value = ''; document.getElementById('tripGewaesser').value = '';
    document.getElementById('tripNotes').value = '';
    updateSelectedTripLocationInfo(null, null);

    if (tripToEditId) {
        const trip = plannedTrips.find(t => String(t.id) === String(tripToEditId));
        if (trip) {
            document.getElementById('tripDate').value = trip.date;
            document.getElementById('tripTime').value = trip.time || '';
            document.getElementById('tripTypeSelect').value = trip.type;
            document.getElementById('tripGewaesser').value = trip.gewaesserId || '';
            updateSelectedTripLocationInfo(trip.gewaesserId, trip.tripLocationCoords);
            document.getElementById('tripNotes').value = trip.notes || '';
        } else { console.error("EDIT ERROR: Trip not found", tripToEditId); }
    } else {
        document.getElementById('tripDate').value = dateString || new Date().toISOString().split('T')[0];
    }
}

function handleTripPlanningSubmit() {
    const tripIdInput = document.getElementById('tripId').value;
    const tripId = tripIdInput ? parseInt(tripIdInput) : null;
    const tripGewaesserHidden = document.getElementById('tripGewaesserHidden').value;
    const tripLocationCoordsStore = document.getElementById('tripLocationCoordsStore').value;
    const mainGewaesserSelectValue = document.getElementById('tripGewaesser').value;
    const tripData = {
        id: tripId || Date.now(), date: document.getElementById('tripDate').value,
        time: document.getElementById('tripTime').value || '', type: document.getElementById('tripTypeSelect').value,
        gewaesserId: (tripLocationCoordsStore && !tripGewaesserHidden) ? null : (tripGewaesserHidden || mainGewaesserSelectValue || null),
        tripLocationCoords: tripLocationCoordsStore || null,
        participants: [], equipment: [], notes: document.getElementById('tripNotes').value || ''
    };
    if (!tripData.date || !tripData.type) { alert("Bitte Datum und Angelart angeben."); return null; }
    if (!tripData.gewaesserId && !tripData.tripLocationCoords) { alert("Bitte Gewässer oder einen Ort auf der Karte auswählen."); return null; }
    const index = plannedTrips.findIndex(t => String(t.id) === String(tripData.id));
    if (index > -1) { plannedTrips[index] = tripData; } else { plannedTrips.push(tripData); }
    localStorage.setItem('plannedTrips', JSON.stringify(plannedTrips));
    return tripData;
}

// --- Test Execution ---
let results = { overall: true, tests: [] };
function runTest(caseNum, description, testFn) {
    console.log(`\n--- Test Case ${caseNum}: ${description} ---`);
    let pass = true;
    let details = [];
    try {
        initializeTestEnvironment();
        testFn(details);
        details.forEach(d => { if (!d.passed) pass = false; });
    } catch (e) {
        console.error(`ERROR in Test ${caseNum}: ${e.message}\n${e.stack}`);
        details.push({ step: 'Execution', passed: false, message: `Runtime error: ${e.message}` });
        pass = false;
    }
    results.tests.push({ case: caseNum, description, pass, details });
    results.overall = results.overall && pass;
    console.log(`--- Test Case ${caseNum} Result: ${pass ? "PASS" : "FAIL"} ---`);
}

// Test Case 1
runTest("1", "New Trip - Select Existing Gewässer", (details) => {
    openTripPlanningModal(null, null);
    openUniversalMapModal('selectLocationForTrip', 'tripGewaesserHidden', 'tripLocationCoordsStore', 'updateSelectedTripLocationInfo');
    selectedGewaesserForCatchMap = "1";
    const testSee = gewaesser.find(g => g.id === "1");
    tempCatchLocationMarker = testSee.location;
    saveCatchLocationFromMap();

    let check = mockDomElements['selectedTripLocationInfo'].innerHTML.includes("Test See");
    details.push({ step: "1.e.1", passed: check, message: `selectedTripLocationInfo has "Test See": ${check}. Actual: "${mockDomElements['selectedTripLocationInfo'].innerHTML}"` });
    check = mockDomElements['tripGewaesserHidden'].value === "1";
    details.push({ step: "1.e.2", passed: check, message: `tripGewaesserHidden is "1": ${check}. Actual: "${mockDomElements['tripGewaesserHidden'].value}"` });
    check = mockDomElements['tripLocationCoordsStore'].value === "50.1,10.1";
    details.push({ step: "1.e.3", passed: check, message: `tripLocationCoordsStore is "50.1,10.1": ${check}. Actual: "${mockDomElements['tripLocationCoordsStore'].value}"` });
    check = mockDomElements['tripGewaesser'].value === "1";
    details.push({ step: "1.e.4", passed: check, message: `tripGewaesser dropdown is "1": ${check}. Actual: "${mockDomElements['tripGewaesser'].value}"` });

    mockDomElements['tripDate'].value = '2024-07-27';
    mockDomElements['tripTypeSelect'].value = "Spinnfischen";
    const savedTrip1 = handleTripPlanningSubmit();
    details.push({ step: "1.f", passed: !!savedTrip1, message: `Trip saved: ${!!savedTrip1}` });

    if (savedTrip1) {
        openTripPlanningModal(null, savedTrip1.id);
        const currentTripId = savedTrip1.id;
        const reloadedTrip = plannedTrips.find(t => t.id === currentTripId);
        if(reloadedTrip) {
            document.getElementById('tripDate').value = reloadedTrip.date;
            document.getElementById('tripTime').value = reloadedTrip.time || '';
            document.getElementById('tripTypeSelect').value = reloadedTrip.type;
            document.getElementById('tripGewaesser').value = reloadedTrip.gewaesserId || '';
            updateSelectedTripLocationInfo(reloadedTrip.gewaesserId, reloadedTrip.tripLocationCoords); //This will set hidden fields too
        }

        check = mockDomElements['selectedTripLocationInfo'].innerHTML.includes("Test See") && mockDomElements['selectedTripLocationInfo'].innerHTML.includes("50.1,10.1");
        details.push({ step: "1.g.1", passed: check, message: `Re-opened trip UI shows "Test See" and coords: ${check}` });
        check = mockDomElements['tripGewaesserHidden'].value === "1";
        details.push({ step: "1.g.2", passed: check, message: `Re-opened tripGewaesserHidden is "1": ${check}`});
    } else {
        details.push({ step: "1.g", passed: false, message: "Cannot verify re-open because trip failed to save." });
    }
});

// Test Case 2
runTest("2", "New Trip - Select New Point on Map (No New Gewässer Creation)", (details) => {
    openTripPlanningModal(null, null);
    openUniversalMapModal('selectLocationForTrip', 'tripGewaesserHidden', 'tripLocationCoordsStore', 'updateSelectedTripLocationInfo');
    selectedGewaesserForCatchMap = null;
    tempCatchLocationMarker = "50.333333,10.333333";
    document.getElementById('newSpotNameInput').value = '';
    saveCatchLocationFromMap();

    let check = mockDomElements['selectedTripLocationInfo'].innerHTML.includes("50.333333,10.333333");
    details.push({ step: "2.e.1", passed: check, message: `selectedTripLocationInfo has coords: ${check}` });
    check = mockDomElements['tripGewaesserHidden'].value === "";
    details.push({ step: "2.e.2", passed: check, message: `tripGewaesserHidden is empty: ${check}` });
    check = mockDomElements['tripLocationCoordsStore'].value === "50.333333,10.333333";
    details.push({ step: "2.e.3", passed: check, message: `tripLocationCoordsStore has coords: ${check}` });
    check = mockDomElements['tripGewaesser'].value === "";
    details.push({ step: "2.e.4", passed: check, message: `tripGewaesser dropdown is empty: ${check}` });

    mockDomElements['tripDate'].value = '2024-07-28';
    mockDomElements['tripTypeSelect'].value = "Grundangeln";
    const savedTrip2 = handleTripPlanningSubmit();
    details.push({ step: "2.f", passed: !!savedTrip2, message: `Trip saved: ${!!savedTrip2}` });

    if (savedTrip2) {
        openTripPlanningModal(null, savedTrip2.id);
        const currentTripId = savedTrip2.id;
        const reloadedTrip = plannedTrips.find(t => t.id === currentTripId);
        if(reloadedTrip) { updateSelectedTripLocationInfo(reloadedTrip.gewaesserId, reloadedTrip.tripLocationCoords); }
        check = mockDomElements['selectedTripLocationInfo'].innerHTML.includes("50.333333,10.333333");
        details.push({ step: "2.g.1", passed: check, message: `Re-opened trip UI shows coords: ${check}` });
        check = mockDomElements['tripGewaesserHidden'].value === "";
        details.push({ step: "2.g.2", passed: check, message: `Re-opened tripGewaesserHidden is empty: ${check}` });
    } else {
         details.push({ step: "2.g", passed: false, message: "Cannot verify re-open because trip failed to save." });
    }
});

// Test Case 3
runTest("3", "New Trip - Select New Point & Create New Gewässer via Map Modal", (details) => {
    openTripPlanningModal(null, null);
    openUniversalMapModal('selectLocationForTrip', 'tripGewaesserHidden', 'tripLocationCoordsStore', 'updateSelectedTripLocationInfo');
    selectedGewaesserForCatchMap = null;
    tempCatchLocationMarker = "50.444444,10.444444";
    document.getElementById('newSpotNameInput').value = 'Karten Spot 1';
    document.getElementById('newGewaesserType_universalMap').value = 'spot';
    saveCatchLocationFromMap();

    const newSpot = gewaesser.find(g => g.name === 'Karten Spot 1');
    const newSpotId = newSpot ? newSpot.id.toString() : null;
    details.push({ step: "3.d_creation", passed: !!newSpotId, message: `New Gewässer "Karten Spot 1" created with ID ${newSpotId}: ${!!newSpotId}` });
    if(!newSpotId) { details.push({step: "3.e", passed: false, message: "Cannot proceed as new spot creation failed."}); return; }

    let check = mockDomElements['selectedTripLocationInfo'].innerHTML.includes("Karten Spot 1") && mockDomElements['selectedTripLocationInfo'].innerHTML.includes("50.444444,10.444444");
    details.push({ step: "3.e.1", passed: check, message: `selectedTripLocationInfo has "Karten Spot 1" and coords: ${check}` });
    check = mockDomElements['tripGewaesserHidden'].value === newSpotId;
    details.push({ step: "3.e.2", passed: check, message: `tripGewaesserHidden is newSpotId ("${newSpotId}"): ${check}` });
    check = mockDomElements['tripLocationCoordsStore'].value === "50.444444,10.444444";
    details.push({ step: "3.e.3", passed: check, message: `tripLocationCoordsStore has coords: ${check}` });
    check = mockDomElements['tripGewaesser'].value === newSpotId;
    details.push({ step: "3.e.4", passed: check, message: `tripGewaesser dropdown is newSpotId ("${newSpotId}"): ${check}` });

    mockDomElements['tripDate'].value = '2024-07-29';
    mockDomElements['tripTypeSelect'].value = "Posenfischen";
    const savedTrip3 = handleTripPlanningSubmit();
    details.push({ step: "3.f", passed: !!savedTrip3, message: `Trip saved: ${!!savedTrip3}` });

    if (savedTrip3) {
        openTripPlanningModal(null, savedTrip3.id);
        const currentTripId = savedTrip3.id;
        const reloadedTrip = plannedTrips.find(t => t.id === currentTripId);
         if(reloadedTrip) { updateSelectedTripLocationInfo(reloadedTrip.gewaesserId, reloadedTrip.tripLocationCoords); }
        check = mockDomElements['selectedTripLocationInfo'].innerHTML.includes("Karten Spot 1");
        details.push({ step: "3.g.1", passed: check, message: `Re-opened trip UI shows "Karten Spot 1": ${check}` });
        check = mockDomElements['tripGewaesserHidden'].value === newSpotId;
        details.push({ step: "3.g.2", passed: check, message: `Re-opened tripGewaesserHidden is newSpotId: ${check}` });
    } else {
        details.push({ step: "3.g", passed: false, message: "Cannot verify re-open because trip failed to save." });
    }
});

// Test Case 4
runTest("4", "Edit Trip - Change from Gewässer to New Point", (details) => {
    openTripPlanningModal(null, null);
    mockDomElements['tripGewaesserHidden'].value = "1";
    mockDomElements['tripLocationCoordsStore'].value = "50.1,10.1";
    updateSelectedTripLocationInfo("1", "50.1,10.1");
    mockDomElements['tripDate'].value = '2024-07-30';
    mockDomElements['tripTypeSelect'].value = "Spinnfischen";
    const tripToEdit = handleTripPlanningSubmit();
    details.push({ step: "4.pre_save", passed: !!tripToEdit, message: `Pre-condition trip saved: ${!!tripToEdit}` });
    if (!tripToEdit) { details.push({ step: "4.a-g", passed: false, message: "Pre-condition failed." }); return; }

    openTripPlanningModal(null, tripToEdit.id);
    openUniversalMapModal('selectLocationForTrip', 'tripGewaesserHidden', 'tripLocationCoordsStore', 'updateSelectedTripLocationInfo');
    selectedGewaesserForCatchMap = null;
    tempCatchLocationMarker = "50.5,10.5";
    document.getElementById('newSpotNameInput').value = '';
    saveCatchLocationFromMap();

    let check = mockDomElements['selectedTripLocationInfo'].innerHTML.includes("50.5,10.5") && !mockDomElements['selectedTripLocationInfo'].innerHTML.includes("Test See");
    details.push({ step: "4.e.1", passed: check, message: `selectedTripLocationInfo shows new coords and not "Test See": ${check}` });
    check = mockDomElements['tripGewaesserHidden'].value === "";
    details.push({ step: "4.e.2", passed: check, message: `tripGewaesserHidden is empty: ${check}` });
    check = mockDomElements['tripLocationCoordsStore'].value === "50.5,10.5";
    details.push({ step: "4.e.3", passed: check, message: `tripLocationCoordsStore is "50.5,10.5": ${check}` });

    // Before saving, ensure the main Gewässer dropdown still has the old value "1"
    // This is to correctly test the fix in handleTripPlanningSubmit
    mockDomElements['tripGewaesser'].value = "1"; // Simulate user not changing main dropdown

    const updatedTrip4 = handleTripPlanningSubmit();
    details.push({ step: "4.f_save", passed: !!updatedTrip4, message: `Trip updated: ${!!updatedTrip4}` });

    if (updatedTrip4) {
        openTripPlanningModal(null, updatedTrip4.id);
        const currentTripId = updatedTrip4.id;
        const reloadedTrip = plannedTrips.find(t => t.id === currentTripId);
        if(reloadedTrip) {
            document.getElementById('tripGewaesser').value = reloadedTrip.gewaesserId || ''; // Sync for next check
            updateSelectedTripLocationInfo(reloadedTrip.gewaesserId, reloadedTrip.tripLocationCoords);
        }
        check = mockDomElements['selectedTripLocationInfo'].innerHTML.includes("50.5,10.5");
        details.push({ step: "4.g.1", passed: check, message: `Re-opened trip UI shows coords: ${check}` });
        check = mockDomElements['tripGewaesserHidden'].value === "";
        details.push({ step: "4.g.2", passed: check, message: `Re-opened tripGewaesserHidden is empty: ${check}` });
        const tripFromStorage = plannedTrips.find(t => t.id === updatedTrip4.id);
        check = tripFromStorage && (tripFromStorage.gewaesserId === null || tripFromStorage.gewaesserId === "");
        details.push({ step: "4.g.3", passed: check, message: `Saved tripData.gewaesserId is null or empty: ${check}` });
    } else {
        details.push({ step: "4.g", passed: false, message: "Cannot verify re-open as trip update failed." });
    }
});

// Test Case 5
runTest("5", "Regression Test - Angelgang Start Modal", (details) => {
    openUniversalMapModal('selectGewasserForAngelgang', 'selectedGewaesserHidden', 'angelgangGewaesserCoordsStore', 'updateSelectedAngelgangGewaesserInfo');
    selectedGewaesserForCatchMap = "2";
    const testFluss = gewaesser.find(g => g.id === "2");
    tempCatchLocationMarker = testFluss.location;
    saveCatchLocationFromMap();
    // The actual updateSelectedAngelgangGewaesserInfo function constructs HTML with <strong> tags
    let check = mockDomElements['selectedAngelgangGewaesserInfo'].innerHTML === "Gewässer: <strong>Test Fluss</strong> | Platz: <strong>50.2,10.2</strong>";
    details.push({ step: "5.d.1", passed: check, message: `selectedAngelgangGewaesserInfo check: ${check}. Actual: "${mockDomElements['selectedAngelgangGewaesserInfo'].innerHTML}"` });
    check = mockDomElements['selectedGewaesserHidden'].value === "2";
    details.push({ step: "5.d.2", passed: check, message: `selectedGewaesserHidden (for angelgang) is "2": ${check}` });
});

// Test Case 6
runTest("6", "Regression Test - Catch Log Modal", (details) => {
    openUniversalMapModal('selectCatchLocation', 'catchGewaesserIdStore', 'catchLocationCoordsStore', 'updateSelectedCatchGewaesserInfo');
    selectedGewaesserForCatchMap = null;
    tempCatchLocationMarker = "50.8,10.8";
    document.getElementById('newSpotNameInput').value = '';
    saveCatchLocationFromMap();
    let check = mockDomElements['selectedCatchGewaesserInfo'].innerHTML === "Fangort: <strong>50.8,10.8</strong>";
    details.push({ step: "6.d.1", passed: check, message: `selectedCatchGewaesserInfo shows coords: ${check}. Actual: "${mockDomElements['selectedCatchGewaesserInfo'].innerHTML}"` });
    check = mockDomElements['catchGewaesserIdStore'].value === "";
    details.push({ step: "6.d.2", passed: check, message: `catchGewaesserIdStore (for catch) is empty: ${check}` });
    check = mockDomElements['catchLocationCoordsStore'].value === "50.8,10.8";
    details.push({ step: "6.d.3", passed: check, message: `catchLocationCoordsStore (for catch) has coords: ${check}` });
});

// --- Output Results ---
console.log("\n\n--- Test Execution Summary ---");
results.tests.forEach(test => {
    console.log(`Test Case ${test.case} (${test.description}): ${test.pass ? "PASS" : "FAIL"}`);
    if (!test.pass) {
        test.details.forEach(detail => {
            if (!detail.passed) {
                console.log(`  [FAIL] Step ${detail.step}: ${detail.message}`);
            }
        });
    }
});
console.log(`\nOverall Test Result: ${results.overall ? "ALL PASS" : "SOME FAILURES"}`);
