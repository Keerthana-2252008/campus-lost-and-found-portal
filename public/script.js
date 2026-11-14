
// ======================================
// API CONFIGURATION
// ======================================

const API_BASE_URL = "https://campus-lost-and-found-portal-0gr2.onrender.com";

// ======================================
// GET HTML ELEMENTS
// ======================================

const statusElement = document.getElementById("status");

const itemForm = document.getElementById("itemForm");
const formMessage = document.getElementById("formMessage");
const itemsList = document.getElementById("itemsList");

const searchInput = document.getElementById("searchInput");
const filterType = document.getElementById("filterType");
const searchButton = document.getElementById("searchButton");

// Student dashboard
const reportedItems = document.getElementById("reportedItems");
const claimedItems = document.getElementById("claimedItems");

// Authentication
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

const loginMessage = document.getElementById("loginMessage");
const registerMessage = document.getElementById("registerMessage");

const authForms = document.getElementById("authForms");
const userDashboard = document.getElementById("userDashboard");
const portalContent = document.getElementById("portalContent");

const userName = document.getElementById("userName");
const userEmail = document.getElementById("userEmail");
const userRole = document.getElementById("userRole");

const logoutButton = document.getElementById("logoutButton");
const profileMessage = document.getElementById("profileMessage");

// Admin dashboard
const adminDashboard = document.getElementById("adminDashboard");
const adminNavLink = document.getElementById("adminNavLink");
const adminMessage = document.getElementById("adminMessage");

const adminUsers = document.getElementById("adminUsers");
const adminItems = document.getElementById("adminItems");
const adminPendingClaims = document.getElementById("adminPendingClaims");

const refreshAdminButton = document.getElementById("refreshAdminButton");

// Admin statistics
const totalUsersElement = document.getElementById("totalUsers");
const totalItemsElement = document.getElementById("totalItems");
const pendingClaimsElement = document.getElementById("pendingClaims");
const recoveredItemsElement = document.getElementById("recoveredItems");
const lostItemsElement = document.getElementById("lostItems");
const foundItemsElement = document.getElementById("foundItems");

// ======================================
// APPLICATION DATA
// ======================================

let allItems = [];
let currentUser = null;

let authToken = sessionStorage.getItem("authToken");

// ======================================
// READ SERVER RESPONSE SAFELY
// ======================================

async function readResponse(response) {
    const responseText = await response.text();

    if (!responseText.trim()) {
        return {};
    }

    try {
        return JSON.parse(responseText);
    } catch (error) {
        throw new Error(
            "Server returned an invalid response. Check the backend."
        );
    }
}

// ======================================
// CHECK SERVER CONNECTION
// ======================================

async function checkServer() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/health`);
        const data = await readResponse(response);

        if (!response.ok) {
            throw new Error(data.message || `HTTP ${response.status}`);
        }

        statusElement.textContent =
            (data.message || "Server connected.") +
            " Database: " +
            (data.database || "Status unavailable");

    } catch (error) {
        statusElement.textContent =
            "Unable to connect to server: " + error.message;

        console.error("Health check failed:", error);
    }
}

// ======================================
// SHOW LOGGED-IN DASHBOARD
// ======================================

function showDashboard(user) {
    currentUser = user;

    authForms.hidden = true;
    userDashboard.hidden = false;
    portalContent.hidden = false;

    userName.textContent = user.name || "Student";
    userEmail.textContent = user.email || "";
    userRole.textContent = user.role || "user";

    profileMessage.textContent = "";

    const isAdmin = user.role === "admin";

    // Show admin dashboard only to admins
    adminDashboard.hidden = !isAdmin;
    adminNavLink.hidden = !isAdmin;

    if (isAdmin) {
        adminMessage.textContent = "Welcome to the Admin Dashboard.";
    } else {
        adminMessage.textContent = "";
    }
}

// ======================================
// SHOW LOGIN AND REGISTRATION FORMS
// ======================================

function showAuthForms() {
    currentUser = null;

    authForms.hidden = false;
    userDashboard.hidden = true;
    portalContent.hidden = true;

    adminDashboard.hidden = true;
    adminNavLink.hidden = true;
}

// ======================================
// STUDENT REGISTRATION
// ======================================

registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const student = {
        name: document.getElementById("registerName").value.trim(),
        email: document.getElementById("registerEmail").value.trim(),
        password: document.getElementById("registerPassword").value
    };

    registerMessage.textContent = "Creating account...";

    try {
        const response = await fetch(
            `${API_BASE_URL}/api/auth/register`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(student)
            }
        );

        const data = await readResponse(response);

        if (!response.ok || data.success === false) {
            throw new Error(data.message || "Registration failed.");
        }

        registerMessage.textContent =
            "Account created successfully! Please log in.";

        document.getElementById("loginEmail").value = student.email;

        registerForm.reset();

    } catch (error) {
        registerMessage.textContent = error.message;
        console.error("Registration error:", error);
    }
});

// ======================================
// STUDENT LOGIN
// ======================================

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const credentials = {
        email: document.getElementById("loginEmail").value.trim(),
        password: document.getElementById("loginPassword").value
    };

    loginMessage.textContent = "Logging in...";

    try {
        const response = await fetch(
            `${API_BASE_URL}/api/auth/login`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(credentials)
            }
        );

        const data = await readResponse(response);

        if (!response.ok || data.success === false) {
            throw new Error(data.message || "Login failed.");
        }

        if (!data.token) {
            throw new Error(
                "Login response did not contain an authentication token."
            );
        }

        authToken = data.token;
        sessionStorage.setItem("authToken", authToken);

        loginForm.reset();
        loginMessage.textContent = "";

        await loadProfile();

    } catch (error) {
        loginMessage.textContent = error.message;
        console.error("Login error:", error);
    }
});

// ======================================
// LOAD LOGGED-IN USER PROFILE
// ======================================

async function loadProfile() {
    if (!authToken) {
        showAuthForms();
        return;
    }

    try {
        const response = await fetch(
            `${API_BASE_URL}/api/auth/profile`,
            {
                method: "GET",
                headers: {
                    "Authorization": "Bearer " + authToken
                }
            }
        );

        const data = await readResponse(response);

        if (!response.ok || data.success === false) {
            throw new Error(data.message || "Profile loading failed.");
        }

        if (!data.user) {
            throw new Error(
                "Student profile was not returned by the server."
            );
        }

        showDashboard(data.user);

        await loadItems();

        if (currentUser && currentUser.role === "admin") {
            await loadAdminDashboard();
        }

    } catch (error) {
        console.error("Profile error:", error);

        authToken = null;
        sessionStorage.removeItem("authToken");

        allItems = [];
        showAuthForms();

        loginMessage.textContent =
            "Your session could not be verified. Please log in again.";
    }
}

// ======================================
// STUDENT LOGOUT
// ======================================

logoutButton.addEventListener("click", () => {
    authToken = null;
    currentUser = null;

    sessionStorage.removeItem("authToken");

    allItems = [];

    showAuthForms();

    itemsList.replaceChildren();
    reportedItems.replaceChildren();
    claimedItems.replaceChildren();

    adminUsers.replaceChildren();
    adminItems.replaceChildren();
    adminPendingClaims.replaceChildren();

    loginMessage.textContent =
        "You have logged out successfully.";

    document.getElementById("account").scrollIntoView({
        behavior: "smooth"
    });
});

// ======================================
// HELPER: GET ID AS STRING
// ======================================

function getId(value) {
    if (!value) {
        return "";
    }

    if (typeof value === "object") {
        return String(value._id || value.id || "");
    }

    return String(value);
}

// ======================================
// GET CURRENT USER ID
// ======================================

function getCurrentUserId() {
    return getId(currentUser?._id || currentUser?.id);
}

// ======================================
// CHECK CLAIM REVIEW PERMISSION
// ======================================

function canReviewClaim(item) {
    if (!currentUser || item.claimStatus !== "Pending") {
        return false;
    }

    const isAdmin = currentUser.role === "admin";

    const isReporter =
        getId(item.reportedBy) === getCurrentUserId();

    return isAdmin || isReporter;
}

// ======================================
// CHECK RECOVERY PERMISSION
// ======================================

function canCompleteRecovery(item) {
    if (!currentUser) {
        return false;
    }

    const isAdmin = currentUser.role === "admin";

    const isReporter =
        getId(item.reportedBy) === getCurrentUserId();

    return (
        (isAdmin || isReporter) &&
        item.claimStatus === "Approved" &&
        item.recoveryStatus === "In Progress"
    );
}

// ======================================
// FORMAT DATE
// ======================================

function formatRecoveryDate(dateValue) {
    if (!dateValue) {
        return "";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return date.toLocaleDateString("en-IN");
}

// ======================================
// CREATE STUDENT DASHBOARD CARD
// ======================================

function createDashboardCard(item, dashboardType) {
    const card = document.createElement("article");
    card.className = "item-card";

    const heading = document.createElement("h4");
    heading.textContent = item.name || "Unnamed Item";

    const type = document.createElement("p");
    type.textContent = "Type: " + (item.type || "Not available");

    const category = document.createElement("p");
    category.textContent = "Category: " + (item.category || "Not specified");

    const location = document.createElement("p");
    location.textContent = "Location: " + (item.location || "Not specified");

    const status = document.createElement("p");
    status.textContent = "Item Status: " + (item.status || "Open");

    card.append(heading, type, category, location, status);

    if (dashboardType === "reported") {
        const claimStatus = document.createElement("p");
        claimStatus.textContent =
            "Claim Status: " + (item.claimStatus || "Not Claimed");

        const recoveryStatus = document.createElement("p");
        recoveryStatus.textContent =
            "Recovery Status: " + (item.recoveryStatus || "Not Started");

        card.append(claimStatus, recoveryStatus);

        if (item.claimDescription) {
            const details = document.createElement("p");
            details.textContent =
                "Student's Claim Details: " + item.claimDescription;

            card.appendChild(details);
        }

        if (item.recoveredAt) {
            const recoveredDate = document.createElement("p");
            recoveredDate.textContent =
                "Recovered On: " + formatRecoveryDate(item.recoveredAt);

            card.appendChild(recoveredDate);
        }
    }

    if (dashboardType === "claimed") {
        const claimStatus = document.createElement("p");
        claimStatus.textContent =
            "My Claim Status: " + (item.claimStatus || "Pending");

        const recoveryStatus = document.createElement("p");
        recoveryStatus.textContent =
            "Recovery Status: " + (item.recoveryStatus || "Not Started");

        card.append(claimStatus, recoveryStatus);

        if (item.claimDescription) {
            const details = document.createElement("p");
            details.textContent =
                "My Claim Details: " + item.claimDescription;

            card.appendChild(details);
        }

        if (item.recoveredAt) {
            const recoveredDate = document.createElement("p");
            recoveredDate.textContent =
                "Recovered On: " + formatRecoveryDate(item.recoveredAt);

            card.appendChild(recoveredDate);
        }
    }

    return card;
}

// ======================================
// DISPLAY MY STUDENT DASHBOARD
// ======================================

function displayMyDashboard() {
    if (!currentUser) {
        return;
    }

    reportedItems.replaceChildren();
    claimedItems.replaceChildren();

    const currentUserId = getCurrentUserId();

    const myReportedItems = allItems.filter((item) => {
        return getId(item.reportedBy) === currentUserId;
    });

    const myClaimedItems = allItems.filter((item) => {
        return getId(item.claimedBy) === currentUserId;
    });

    if (myReportedItems.length === 0) {
        const message = document.createElement("p");
        message.textContent = "You have not reported any items yet.";
        reportedItems.appendChild(message);
    } else {
        myReportedItems.forEach((item) => {
            reportedItems.appendChild(
                createDashboardCard(item, "reported")
            );
        });
    }

    if (myClaimedItems.length === 0) {
        const message = document.createElement("p");
        message.textContent = "You have not claimed any items yet.";
        claimedItems.appendChild(message);
    } else {
        myClaimedItems.forEach((item) => {
            claimedItems.appendChild(
                createDashboardCard(item, "claimed")
            );
        });
    }
}

// ======================================
// DISPLAY BROWSE ITEMS
// ======================================

function displayItems(items) {
    itemsList.replaceChildren();

    if (items.length === 0) {
        const message = document.createElement("p");
        message.textContent = "No matching items found.";
        itemsList.appendChild(message);
        return;
    }

    items.forEach((item) => {
        const card = document.createElement("article");
        card.className = "item-card";

        const heading = document.createElement("h3");
        heading.textContent = item.name || "Unnamed Item";

        const type = document.createElement("p");
        type.textContent = "Type: " + item.type;

        const category = document.createElement("p");
        category.textContent = "Category: " + item.category;

        const location = document.createElement("p");
        location.textContent = "Location: " + item.location;

        const description = document.createElement("p");
        description.textContent = "Description: " + item.description;

        const status = document.createElement("p");
        status.textContent =
            "Status: " +
            (item.claimStatus === "Pending"
                ? "Pending Claim"
                : item.status);

        card.append(heading, type, category, location, description, status);

        const recoveryStatus = document.createElement("p");
        recoveryStatus.textContent =
            "Recovery Status: " + (item.recoveryStatus || "Not Started");

        card.appendChild(recoveryStatus);

        if (item.recoveryStatus === "Recovered" && item.recoveredAt) {
            const recoveredDate = document.createElement("p");
            recoveredDate.textContent =
                "Recovered On: " + formatRecoveryDate(item.recoveredAt);

            card.appendChild(recoveredDate);
        }

        // CLAIM BUTTON

        const isOwnItem =
            getId(item.reportedBy) === getCurrentUserId();

        const canClaim =
            item.type === "Found" &&
            item.status === "Open" &&
            item.claimStatus !== "Pending" &&
            item.claimStatus !== "Approved" &&
            !isOwnItem;

        if (canClaim) {
            const claimButton = document.createElement("button");

            claimButton.type = "button";
            claimButton.textContent = "Claim Item";
            claimButton.className = "claim-button";

            claimButton.addEventListener("click", () => {
                showClaimForm(item);
            });

            card.appendChild(claimButton);
        }

        // CLAIM REVIEW

        if (canReviewClaim(item)) {
            const reviewSection = createClaimReviewSection(item);
            card.appendChild(reviewSection);
        }

        // RECOVERY TRACKING

        if (canCompleteRecovery(item)) {
            const recoverySection = document.createElement("div");
            recoverySection.className = "recovery-section";

            const recoveryHeading = document.createElement("h4");
            recoveryHeading.textContent = "Recovery Tracking";

            const instructions = document.createElement("p");
            instructions.textContent =
                "Confirm when the item has been returned to its owner.";

            const recoveredButton = document.createElement("button");
            recoveredButton.type = "button";
            recoveredButton.textContent = "Mark as Recovered";
            recoveredButton.className = "recovered-button";

            const recoveryMessage = document.createElement("p");
            recoveryMessage.className = "recovery-message";

            recoveredButton.addEventListener("click", () => {
                completeRecovery(
                    item._id,
                    recoveryMessage,
                    recoveredButton
                );
            });

            recoverySection.append(
                recoveryHeading,
                instructions,
                recoveredButton,
                recoveryMessage
            );

            card.appendChild(recoverySection);
        }

        itemsList.appendChild(card);
    });
}

// ======================================
// CREATE CLAIM REVIEW SECTION
// ======================================

function createClaimReviewSection(item) {
    const reviewSection = document.createElement("div");
    reviewSection.className = "claim-review";

    const heading = document.createElement("h4");
    heading.textContent = "Claim Review";

    const details = document.createElement("p");
    details.textContent =
        "Claim details: " +
        (item.claimDescription || "No details provided.");

    const approveButton = document.createElement("button");
    approveButton.type = "button";
    approveButton.textContent = "Approve Claim";
    approveButton.className = "approve-button";

    const rejectButton = document.createElement("button");
    rejectButton.type = "button";
    rejectButton.textContent = "Reject Claim";
    rejectButton.className = "reject-button";

    const message = document.createElement("p");
    message.className = "review-message";

    approveButton.addEventListener("click", () => {
        reviewClaim(item._id, "approve", message, [
            approveButton,
            rejectButton
        ]);
    });

    rejectButton.addEventListener("click", () => {
        reviewClaim(item._id, "reject", message, [
            approveButton,
            rejectButton
        ]);
    });

    reviewSection.append(
        heading,
        details,
        approveButton,
        rejectButton,
        message
    );

    return reviewSection;
}

// ======================================
// APPROVE OR REJECT CLAIM
// ======================================

async function reviewClaim(itemId, action, messageElement, buttons) {
    if (!authToken) {
        messageElement.textContent =
            "Please log in to review this claim.";
        return;
    }

    const confirmation =
        action === "approve"
            ? "Are you sure you want to approve this claim?"
            : "Are you sure you want to reject this claim?";

    if (!window.confirm(confirmation)) {
        return;
    }

    buttons.forEach((button) => {
        button.disabled = true;
    });

    messageElement.textContent = "Processing your decision...";

    try {
        const response = await fetch(
            `${API_BASE_URL}/api/items/${encodeURIComponent(itemId)}/claim/review`,
            {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + authToken
                },
                body: JSON.stringify({ action })
            }
        );

        const data = await readResponse(response);

        if (response.status === 401) {
            authToken = null;
            sessionStorage.removeItem("authToken");
            showAuthForms();

            throw new Error(
                "Your session expired. Please log in again."
            );
        }

        if (!response.ok || data.success === false) {
            throw new Error(
                data.message || "Unable to review this claim."
            );
        }

        messageElement.textContent =
            action === "approve"
                ? "Claim approved successfully!"
                : "Claim rejected successfully!";

        await loadItems();

        if (currentUser?.role === "admin") {
            await loadAdminDashboard();
        }

    } catch (error) {
        messageElement.textContent = error.message;

        buttons.forEach((button) => {
            button.disabled = false;
        });

        console.error("Claim review error:", error);
    }
}

// ======================================
// COMPLETE ITEM RECOVERY
// ======================================

async function completeRecovery(itemId, messageElement, button) {
    if (!authToken) {
        messageElement.textContent =
            "Please log in to update recovery status.";
        return;
    }

    const confirmation = window.confirm(
        "Confirm that this item has been returned to its owner?"
    );

    if (!confirmation) {
        return;
    }

    button.disabled = true;
    messageElement.textContent = "Updating recovery status...";

    try {
        const response = await fetch(
            `${API_BASE_URL}/api/items/${encodeURIComponent(itemId)}/recovery/complete`,
            {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + authToken
                }
            }
        );

        const data = await readResponse(response);

        if (response.status === 401) {
            authToken = null;
            sessionStorage.removeItem("authToken");
            showAuthForms();

            throw new Error(
                "Your session expired. Please log in again."
            );
        }

        if (!response.ok || data.success === false) {
            throw new Error(
                data.message || "Unable to complete recovery."
            );
        }

        messageElement.textContent =
            "Item marked as recovered successfully!";

        await loadItems();

        if (currentUser?.role === "admin") {
            await loadAdminDashboard();
        }

    } catch (error) {
        messageElement.textContent = error.message;
        button.disabled = false;

        console.error("Recovery update error:", error);
    }
}

// ======================================
// SHOW CLAIM FORM
// ======================================

function showClaimForm(item) {
    const existingForm = document.getElementById("claimForm");

    if (existingForm) {
        existingForm.remove();
    }

    const claimSection = document.createElement("section");

    claimSection.id = "claimForm";
    claimSection.className = "claim-form";

    const heading = document.createElement("h3");
    heading.textContent = "Claim: " + item.name;

    const instructions = document.createElement("p");
    instructions.textContent =
        "Describe the item and provide details that help verify it belongs to you.";

    const textarea = document.createElement("textarea");

    textarea.id = "claimDescription";
    textarea.placeholder = "Explain why this item belongs to you...";
    textarea.required = true;
    textarea.maxLength = 1000;
    textarea.rows = 4;

    const message = document.createElement("p");
    message.id = "claimMessage";

    const submitButton = document.createElement("button");
    submitButton.type = "button";
    submitButton.textContent = "Submit Claim";

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.textContent = "Cancel";

    cancelButton.addEventListener("click", () => {
        claimSection.remove();
    });

    submitButton.addEventListener("click", async () => {
        const claimDescription = textarea.value.trim();

        if (!claimDescription) {
            message.textContent = "Please enter your claim details.";
            return;
        }

        if (claimDescription.length > 1000) {
            message.textContent =
                "Claim details cannot exceed 1000 characters.";
            return;
        }

        submitButton.disabled = true;
        message.textContent = "Submitting your claim...";

        try {
            const response = await fetch(
                `${API_BASE_URL}/api/items/${encodeURIComponent(item._id)}/claim`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": "Bearer " + authToken
                    },
                    body: JSON.stringify({ claimDescription })
                }
            );

            const data = await readResponse(response);

            if (response.status === 401) {
                authToken = null;
                sessionStorage.removeItem("authToken");
                showAuthForms();

                throw new Error(
                    "Your session expired. Please log in again."
                );
            }

            if (!response.ok || data.success === false) {
                throw new Error(
                    data.message || "Could not submit claim."
                );
            }

            message.textContent =
                "Claim submitted successfully! It is now pending review.";

            await loadItems();

            setTimeout(() => {
                claimSection.remove();
            }, 1500);

        } catch (error) {
            message.textContent = error.message;
            submitButton.disabled = false;

            console.error("Claim submission error:", error);
        }
    });

    claimSection.append(
        heading,
        instructions,
        textarea,
        submitButton,
        cancelButton,
        message
    );

    itemsList.prepend(claimSection);

    claimSection.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
}

// ======================================
// LOAD ITEMS FROM DATABASE
// ======================================

async function loadItems() {
    if (!authToken) {
        return;
    }

    try {
        itemsList.textContent = "Loading items...";

        const response = await fetch(
            `${API_BASE_URL}/api/items`
        );

        const data = await readResponse(response);

        if (!response.ok) {
            throw new Error(
                data.message || "Server returned status " + response.status
            );
        }

        allItems = Array.isArray(data.items)
            ? data.items
            : [];

        console.log("Items loaded:", allItems);

        searchItems();
        displayMyDashboard();

    } catch (error) {
        console.error("Loading items failed:", error);

        itemsList.replaceChildren();

        const message = document.createElement("p");
        message.textContent =
            "Error loading items: " + error.message;

        itemsList.appendChild(message);

        reportedItems.textContent =
            "Unable to load your reported items.";

        claimedItems.textContent =
            "Unable to load your claimed items.";
    }
}

// ======================================
// SEARCH AND FILTER ITEMS
// ======================================

function searchItems() {
    const keyword = searchInput.value.trim().toLowerCase();
    const selectedType = filterType.value;

    const filteredItems = allItems.filter((item) => {
        const searchableText = [
            item.name || "",
            item.category || "",
            item.location || "",
            item.description || ""
        ].join(" ").toLowerCase();

        const matchesKeyword =
            searchableText.includes(keyword);

        const matchesType =
            selectedType === "All" ||
            item.type === selectedType;

        return matchesKeyword && matchesType;
    });

    displayItems(filteredItems);
}

// ======================================
// ADMIN: LOAD COMPLETE ADMIN DASHBOARD
// ======================================

async function loadAdminDashboard() {
    if (!authToken || currentUser?.role !== "admin") {
        return;
    }

    adminMessage.textContent = "Loading admin dashboard...";

    try {
        const headers = {
            "Authorization": "Bearer " + authToken
        };

        const [
            dashboardResponse,
            usersResponse,
            itemsResponse,
            claimsResponse
        ] = await Promise.all([
            fetch(`${API_BASE_URL}/api/admin/dashboard`, { headers }),
            fetch(`${API_BASE_URL}/api/admin/users`, { headers }),
            fetch(`${API_BASE_URL}/api/admin/items`, { headers }),
            fetch(`${API_BASE_URL}/api/admin/claims/pending`, { headers })
        ]);

        const [
            dashboardData,
            usersData,
            itemsData,
            claimsData
        ] = await Promise.all([
            readResponse(dashboardResponse),
            readResponse(usersResponse),
            readResponse(itemsResponse),
            readResponse(claimsResponse)
        ]);

        if (
            !dashboardResponse.ok ||
            !usersResponse.ok ||
            !itemsResponse.ok ||
            !claimsResponse.ok
        ) {
            const errorData = [
                dashboardData,
                usersData,
                itemsData,
                claimsData
            ].find((data) => data.success === false);

            throw new Error(
                errorData?.message || "Unable to load admin information."
            );
        }

        if (
            dashboardData.success === false ||
            usersData.success === false ||
            itemsData.success === false ||
            claimsData.success === false
        ) {
            throw new Error("The server could not load admin information.");
        }

        displayAdminStatistics(dashboardData.dashboard || {});

        displayAdminUsers(
            Array.isArray(usersData.users) ? usersData.users : []
        );

        displayAdminItems(
            Array.isArray(itemsData.items) ? itemsData.items : []
        );

        displayAdminPendingClaims(
            Array.isArray(claimsData.claims) ? claimsData.claims : []
        );

        adminMessage.textContent =
            "Admin dashboard updated successfully.";

    } catch (error) {
        adminMessage.textContent =
            "Admin dashboard error: " + error.message;

        console.error("Admin dashboard error:", error);
    }
}

// ======================================
// ADMIN: DISPLAY STATISTICS
// ======================================

function displayAdminStatistics(stats) {
    totalUsersElement.textContent = stats.totalUsers ?? 0;
    totalItemsElement.textContent = stats.totalItems ?? 0;
    pendingClaimsElement.textContent = stats.pendingClaims ?? 0;
    recoveredItemsElement.textContent = stats.recoveredItems ?? 0;
    lostItemsElement.textContent = stats.lostItems ?? 0;
    foundItemsElement.textContent = stats.foundItems ?? 0;
}

// ======================================
// ADMIN: DISPLAY ALL USERS
// ======================================

function displayAdminUsers(users) {
    adminUsers.replaceChildren();

    if (users.length === 0) {
        const message = document.createElement("p");
        message.textContent = "No registered students found.";
        adminUsers.appendChild(message);
        return;
    }

    users.forEach((user) => {
        const card = document.createElement("article");
        card.className = "item-card admin-user-card";

        const heading = document.createElement("h3");
        heading.textContent = user.name || "Unnamed Student";

        const email = document.createElement("p");
        email.textContent = "Email: " + (user.email || "Not available");

        const role = document.createElement("p");
        role.textContent = "Role: " + (user.role || "user");

        const joined = document.createElement("p");
        joined.textContent =
            "Registered: " +
            (user.createdAt ? formatRecoveryDate(user.createdAt) : "Not available");

        card.append(heading, email, role, joined);

        adminUsers.appendChild(card);
    });
}

// ======================================
// ADMIN: DISPLAY ALL REPORTED ITEMS
// ======================================

function displayAdminItems(items) {
    adminItems.replaceChildren();

    if (items.length === 0) {
        const message = document.createElement("p");
        message.textContent = "No reported items found.";
        adminItems.appendChild(message);
        return;
    }

    items.forEach((item) => {
        const card = document.createElement("article");
        card.className = "item-card admin-item-card";

        const heading = document.createElement("h3");
        heading.textContent = item.name || "Unnamed Item";

        const type = document.createElement("p");
        type.textContent = "Type: " + (item.type || "Not available");

        const category = document.createElement("p");
        category.textContent = "Category: " + (item.category || "Not specified");

        const location = document.createElement("p");
        location.textContent = "Location: " + (item.location || "Not specified");

        const status = document.createElement("p");
        status.textContent = "Item Status: " + (item.status || "Open");

        const claimStatus = document.createElement("p");
        claimStatus.textContent =
            "Claim Status: " + (item.claimStatus || "Not Claimed");

        const recoveryStatus = document.createElement("p");
        recoveryStatus.textContent =
            "Recovery Status: " + (item.recoveryStatus || "Not Started");

        const reporter = document.createElement("p");
        reporter.textContent =
            "Reported By: " +
            (item.reportedBy?.name || "Unknown");

        const claimant = document.createElement("p");
        claimant.textContent =
            "Claimed By: " +
            (item.claimedBy?.name || "No claimant");

        card.append(
            heading,
            type,
            category,
            location,
            status,
            claimStatus,
            recoveryStatus,
            reporter,
            claimant
        );

        adminItems.appendChild(card);
    });
}

// ======================================
// ADMIN: DISPLAY PENDING CLAIMS
// ======================================

function displayAdminPendingClaims(claims) {
    adminPendingClaims.replaceChildren();

    if (claims.length === 0) {
        const message = document.createElement("p");
        message.textContent = "There are no pending claims.";
        adminPendingClaims.appendChild(message);
        return;
    }

    claims.forEach((item) => {
        const card = document.createElement("article");
        card.className = "item-card admin-claim-card";

        const heading = document.createElement("h3");
        heading.textContent = item.name || "Unnamed Item";

        const type = document.createElement("p");
        type.textContent = "Type: " + (item.type || "Not available");

        const category = document.createElement("p");
        category.textContent = "Category: " + (item.category || "Not specified");

        const reporter = document.createElement("p");
        reporter.textContent =
            "Reported By: " +
            (item.reportedBy?.name || "Unknown");

        const claimant = document.createElement("p");
        claimant.textContent =
            "Claimed By: " +
            (item.claimedBy?.name || "Unknown");

        const claimDetails = document.createElement("p");
        claimDetails.textContent =
            "Claim Details: " +
            (item.claimDescription || "No details provided.");

        const claimStatus = document.createElement("p");
        claimStatus.textContent = "Claim Status: Pending";

        const approveButton = document.createElement("button");
        approveButton.type = "button";
        approveButton.textContent = "Approve Claim";
        approveButton.className = "approve-button";

        const rejectButton = document.createElement("button");
        rejectButton.type = "button";
        rejectButton.textContent = "Reject Claim";
        rejectButton.className = "reject-button";

        const message = document.createElement("p");
        message.className = "review-message";

        approveButton.addEventListener("click", () => {
            reviewClaim(item._id, "approve", message, [
                approveButton,
                rejectButton
            ]);
        });

        rejectButton.addEventListener("click", () => {
            reviewClaim(item._id, "reject", message, [
                approveButton,
                rejectButton
            ]);
        });

        card.append(
            heading,
            type,
            category,
            reporter,
            claimant,
            claimDetails,
            claimStatus,
            approveButton,
            rejectButton,
            message
        );

        adminPendingClaims.appendChild(card);
    });
}

// ======================================
// ADMIN: REFRESH BUTTON
// ======================================

refreshAdminButton.addEventListener("click", async () => {
    refreshAdminButton.disabled = true;
    refreshAdminButton.textContent = "Refreshing...";

    await loadAdminDashboard();

    refreshAdminButton.disabled = false;
    refreshAdminButton.textContent = "Refresh Admin Dashboard";
});

// ======================================
// REPORT A LOST OR FOUND ITEM
// ======================================

itemForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!authToken) {
        formMessage.textContent =
            "Please log in before reporting an item.";

        showAuthForms();
        return;
    }

    const item = {
        name: document.getElementById("itemName").value.trim(),
        type: document.getElementById("itemType").value,
        category: document.getElementById("category").value,
        description: document.getElementById("description").value.trim(),
        location: document.getElementById("location").value.trim(),
        date: document.getElementById("itemDate").value
    };

    formMessage.textContent = "Submitting report...";

    try {
        const response = await fetch(
            `${API_BASE_URL}/api/items`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + authToken
                },
                body: JSON.stringify(item)
            }
        );

        const data = await readResponse(response);

        if (response.status === 401) {
            authToken = null;
            sessionStorage.removeItem("authToken");
            showAuthForms();

            throw new Error(
                "Your session expired. Please log in again."
            );
        }

        if (!response.ok || data.success === false) {
            throw new Error(
                data.message || "Could not submit report."
            );
        }

        formMessage.textContent =
            "Report submitted successfully!";

        itemForm.reset();

        await loadItems();

        if (currentUser?.role === "admin") {
            await loadAdminDashboard();
        }

    } catch (error) {
        console.error("Submitting item failed:", error);
        formMessage.textContent = error.message;
    }
});

// ======================================
// SEARCH EVENTS
// ======================================

searchButton.addEventListener("click", searchItems);

searchInput.addEventListener("input", searchItems);

filterType.addEventListener("change", searchItems);

// ======================================
// START APPLICATION
// ======================================

showAuthForms();

checkServer();

loadProfile();
