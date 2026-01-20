$url = "https://ghtshhafukyirwkfdype.supabase.co/rest/v1/jobs"
$apiKey = "sb_publishable_TES0Vyz0LIYnQ04wHGBzQQ_3GaCei6Z"
$headers = @{
    "apikey"        = $apiKey
    "Authorization" = "Bearer $apiKey"
    "Content-Type"  = "application/json"
    "Prefer"        = "return=minimal"
}

# Fetch some poster IDs first
$profilesUrl = "https://ghtshhafukyirwkfdype.supabase.co/rest/v1/profiles?select=id&limit=10"
$profilesResponse = Invoke-RestMethod -Uri $profilesUrl -Headers $headers -Method Get
$posterIds = $profilesResponse.id

if ($null -eq $posterIds -or $posterIds.Count -eq 0) {
    Write-Host "No profiles found to act as posters. Aborting."
    exit
}

Write-Host "🚀 Starting Seeding of 100 Regional Jobs via PowerShell..."

$punjabLocs = @(
    @{ name = "Nakodar, Punjab"; lat = 31.1265; lng = 75.4719 },
    @{ name = "Raikot, Punjab"; lat = 30.6541; lng = 75.6124 },
    @{ name = "Mullanpur, Punjab"; lat = 30.9328; lng = 75.7176 }
)

$himachalLocs = @(
    @{ name = "Kotkhai, Himachal"; lat = 31.1217; lng = 77.5317 },
    @{ name = "Manali, Himachal"; lat = 32.2432; lng = 77.1892 },
    @{ name = "Kasol, Himachal"; lat = 32.0099; lng = 77.3111 }
)

for ($i = 0; $i -lt 100; $i++) {
    $isHimachal = $false
    if ($i -ge 75) { $isHimachal = $true }
    
    $loc = $null
    if ($isHimachal) {
        $loc = $himachalLocs[$i % $himachalLocs.Count]
    }
    else {
        $loc = $punjabLocs[$i % $punjabLocs.Count]
    }
    
    $posterId = $posterIds[$i % $posterIds.Count]
    $title = ""
    $desc = ""
    $cat = ""
    $budget = Get-Random -Minimum 500 -Maximum 2500

    if ($i -lt 50) {
        $cat = "Farm Labor"
        $vIndex = $i % 3
        if ($vIndex -eq 0) { $title = "Grain Mandi Helper | अनाज मंडी सहायक"; $desc = "Lifting and stacking bags. बोरियों की लोडिंग और स्टैकिंग।" }
        if ($vIndex -eq 1) { $title = "Tractor Mechanic | ट्रैक्टर मैकेनिक"; $desc = "Need urgent engine repair. इंजन की मरम्मत की जरूरत है।" }
        if ($vIndex -eq 2) { $title = "Wheat Harvester | गेहूं काटने वाला"; $desc = "Need expert for 2 days. 2 दिन के लिए एक्सपर्ट चाहिए।" }
    }
    elseif ($i -lt 75) {
        $vIndex = $i % 3
        if ($vIndex -eq 0) { $title = "Factory Labor | फैक्ट्री लेबर"; $desc = "Ludhiana Focal Point work. लुधियाना फोकल पॉइंट में काम।"; $cat = "Construction" }
        if ($vIndex -eq 1) { $title = "Sports Goods Helper | स्पोर्ट्स सामान सहायक"; $desc = "Packing cricket bats. क्रिकेट बैट की पैकिंग का काम।"; $cat = "Other" }
        if ($vIndex -eq 2) { $title = "Local Delivery | लोकल डिलीवरी"; $desc = "Grocery delivery in Amritsar. अमृतसर में राशन की डिलीवरी।"; $cat = "Delivery" }
    }
    else {
        $vIndex = $i % 3
        if ($vIndex -eq 0) { $title = "Apple Harvester | सेब तोड़ने वाला"; $desc = "Orchard work in Shimla. शिमला के बागानों में काम।"; $cat = "Farm Labor" }
        if ($vIndex -eq 1) { $title = "Hotel Cleaner | होटल की सफाई"; $desc = "Cleanup for Manali resort. मनाली रिजॉर्ट की सफाई।"; $cat = "Cleaning" }
        if ($vIndex -eq 2) { $title = "Mule Driver | खच्चर चलाने वाला"; $desc = "Transport to mountain village. पहाड़ों में सामान ले जाने के लिए।" ; $cat = "Other" }
    }

    $latOffset = (Get-Random -Minimum -100 -Maximum 100) / 10000.0
    $lngOffset = (Get-Random -Minimum -100 -Maximum 100) / 10000.0
    $finalLat = $loc.lat + $latOffset
    $finalLng = $loc.lng + $lngOffset
    $jobDateString = (Get-Date).AddDays($i % 7).ToString("yyyy-MM-dd")
    $createdAtString = (Get-Date).AddHours(-$i).ToString("yyyy-MM-ddTHH:mm:ssZ")
    
    $duration = "1 Week"
    if ($i % 3 -eq 0) { $duration = "Short Term" }

    $body = @{
        poster_id   = $posterId
        title       = $title
        description = $desc
        category    = $cat
        location    = $loc.name
        latitude    = $finalLat
        longitude   = $finalLng
        job_date    = $jobDateString
        duration    = $duration
        budget      = $budget
        status      = "OPEN"
        created_at  = $createdAtString
    }
    
    $bodyJson = $body | ConvertTo-Json

    Invoke-RestMethod -Uri $url -Headers $headers -Method Post -Body $bodyJson | Out-Null
    
    if ($i % 10 -eq 0) { Write-Host "Seeded $i jobs..." }
}

Write-Host "✅ Successfully seeded 100 regional jobs!"
