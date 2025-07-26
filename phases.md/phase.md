# 📍 CitySense Visualization Phase – Frontend Plan & Checklist

## ✅ Task Checklist

### 🔍 Data Filtering

- [ ] Only show **issues** with `credibility > 0.5`
- [X] Use `normalizedHeatScore` (0.0–1.0) to define **heat intensity**
- [X] Ignore issues with no reports

---

### 🗺️ Heatmap Preparation

- [X] For each qualifying `issue`, fetch all `reports` (`issues/{issueId}/reports`)
- [X] For each `report`, generate a heatmap point:
  ```ts
  {
    lat: report.lat,
    lng: report.lng,
    weight: issue.normalizedHeatScore
  }
  ```
- [ ] Collect all such points into one array for rendering

---

### 🌈 Heatmap Display

- [X] Render a **Google Maps / Mapbox heatmap** using points with:
  - Adjustable heat radius
  - Gradient color based on intensity (e.g., green → yellow → red)
- [X] Normalize the `normalizedHeatScore` if required by the heatmap library

---

### 🗂️ Issue Marker Display

- [X] Overlay map markers for each issue with `credibility > 0.5`
- [X] Marker color based on `dominantSentiment`
- [X] Marker size or style reflects `normalizedHeatScore`

---

### 🧠 Info Windows / Popups

- [X] On marker click, display:
  - `latestSummary`
  - `category`, `credibility`, `normalizedHeatScore`
  - `dominantSentiment`, `dominantUrgency`
  - One thumbnail image (from `images/` subcollection if available)

---

## 🛠️ Step-by-Step Implementation Plan

### Step 1: Backend Fetch

- [ ] Fetch all open `issues` with:
  ```ts
  where('credibility', '>', 0.5).where('status', '==', 'open')
  ```
- [ ] For each issue, retrieve:
  - `location`, `normalizedHeatScore`, `dominantSentiment`, etc.
  - All `reports/` to build heatmap points

---

### Step 2: Build Heatmap Points

- [ ] For each report of the issue, construct:
  ```ts
  {
    lat: report.lat,
    lng: report.lng,
    weight: issue.normalizedHeatScore
  }
  ```

---

### Step 3: Map UI Integration

- [ ] Use Google Maps or Mapbox to:
  - Render the heatmap layer (from above array)
  - Add marker layer for issues

---

### Step 4: Marker Design (Sentiment Based)

| Sentiment | Marker Color |
| --------- | ------------ |
| negative  | 🔴 Red       |
| neutral   | 🟡 Yellow    |
| positive  | 🟢 Green     |

---

## 📌 Notes

- `normalizedHeatScore` already reflects report count × urgency × sentiment.
- This unified metric is ideal for visualizing public signal intensity.
