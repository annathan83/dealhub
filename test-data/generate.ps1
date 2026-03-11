# DealHub Test Data Generator
# Run: powershell -ExecutionPolicy Bypass -File generate.ps1

$root = $PSScriptRoot

$industries = @(
  @{ name="Childcare Center";        category="Children's Services" },
  @{ name="Landscaping Company";     category="Home Services" },
  @{ name="Medical Spa";             category="Health and Beauty" },
  @{ name="Auto Repair Shop";        category="Automotive" },
  @{ name="Staffing Agency";         category="Business Services" },
  @{ name="HVAC Company";            category="Home Services" },
  @{ name="Commercial Cleaning";     category="Home Services" },
  @{ name="Logistics Company";       category="Transportation" },
  @{ name="Pizza Restaurant";        category="Food and Beverage" },
  @{ name="Dental Practice";         category="Healthcare" },
  @{ name="Plumbing Company";        category="Home Services" },
  @{ name="IT Managed Services";     category="Technology" },
  @{ name="Pool Service Route";      category="Home Services" },
  @{ name="Insurance Agency";        category="Financial Services" },
  @{ name="Laundromat";              category="Retail" },
  @{ name="Tutoring Center";         category="Education" },
  @{ name="Pest Control Company";    category="Home Services" },
  @{ name="Physical Therapy Clinic"; category="Healthcare" },
  @{ name="E-Commerce Business";     category="Retail" },
  @{ name="Electrical Contractor";   category="Home Services" }
)

$cities = @(
  @{ city="Miami";           state="FL" },
  @{ city="Fort Lauderdale"; state="FL" },
  @{ city="Boca Raton";      state="FL" },
  @{ city="Tampa";           state="FL" },
  @{ city="Orlando";         state="FL" },
  @{ city="Naples";          state="FL" },
  @{ city="Jacksonville";    state="FL" },
  @{ city="Sarasota";        state="FL" },
  @{ city="West Palm Beach"; state="FL" },
  @{ city="Clearwater";      state="FL" }
)

$brokerFirstNames = @("James","Linda","Robert","Patricia","Michael","Barbara","David","Susan","Richard","Karen","Thomas","Nancy","Charles","Lisa","Christopher","Betty","Daniel","Margaret","Matthew","Sandra")
$brokerLastNames  = @("Anderson","Thompson","Martinez","Garcia","Wilson","Davis","Rodriguez","Lee","White","Harris","Clark","Lewis","Robinson","Walker","Hall","Allen","Young","King","Wright","Scott")
$brokerFirms      = @("Sunbelt Business Advisors","VR Business Brokers","Murphy Business","Transworld Business Advisors","First Choice Business Brokers","Amerivest Business Brokers","Florida Business Exchange","Southeast Business Brokers","Coastal Business Advisors","National Business Brokers")

$rng = New-Object System.Random 42

function RandInt($min, $max) { $rng.Next($min, $max+1) }
function RandItem($arr) { $arr[$rng.Next(0, $arr.Count)] }
function RandBool { $rng.Next(0,2) -eq 1 }

function FormatK($n) {
  if ($n -eq $null -or $n -eq 0) { return "N/A" }
  $style = RandInt 0 4
  switch ($style) {
    0 { return '$' + [string][math]::Round($n/1000) + 'K' }
    1 { return '$' + [string][math]::Round($n/1000) + 'k' }
    2 { return '$' + ("{0:N0}" -f $n) }
    3 { return ([string][math]::Round($n/1000)) + 'K' }
    4 { return '$' + ("{0:N2}" -f ($n/1000000)) + 'M' }
  }
}

function FormatKMessy($n) {
  $style = RandInt 0 5
  switch ($style) {
    0 { return "approx " + (FormatK $n) }
    1 { return "~" + (FormatK $n) }
    2 { return "around " + (FormatK $n) }
    3 { return "est. " + (FormatK $n) }
    4 { return (FormatK $n) + " (approx)" }
    5 { return (FormatK $n) }
  }
}

function GenRevenue { RandInt 400000 4000000 }
function GenSDE($rev) { [int]($rev * ($rng.NextDouble() * 0.15 + 0.10)) }
function GenPrice($sde) { [int]($sde * ($rng.NextDouble() * 1.5 + 1.5)) }
function GenMultiple($price, $sde) { [math]::Round($price / $sde, 1) }

function MakeBrokerName { (RandItem $brokerFirstNames) + " " + (RandItem $brokerLastNames) }
function MakeBrokerPhone {
  $area = RandInt 200 999
  $mid  = RandInt 200 999
  $end  = RandInt 1000 9999
  $style = RandInt 0 3
  switch ($style) {
    0 { return "($area) $mid-$end" }
    1 { return "$area-$mid-$end" }
    2 { return "$area.$mid.$end" }
    3 { return "$area $mid $end" }
  }
}
function MakeBrokerEmail($name) {
  $parts = $name.ToLower() -split " "
  $firm  = (RandItem $brokerFirms).ToLower() -replace "[^a-z]",""
  $style = RandInt 0 2
  switch ($style) {
    0 { return $parts[0] + "." + $parts[1] + "@" + $firm + ".com" }
    1 { return $parts[0][0] + $parts[1] + "@" + $firm + ".com" }
    2 { return $parts[0] + "@" + $firm + ".com" }
  }
}

# ============================================================
# LISTINGS (200 files)
# ============================================================

$listingDir = Join-Path $root "listings"

for ($i = 1; $i -le 200; $i++) {
  $ind    = RandItem $industries
  $loc    = RandItem $cities
  $rev    = GenRevenue
  $sde    = GenSDE $rev
  $price  = GenPrice $sde
  $mult   = GenMultiple $price $sde
  $yrs    = RandInt 3 25
  $emp    = RandInt 2 45
  $broker = MakeBrokerName
  $firm   = RandItem $brokerFirms

  $style = RandInt 0 4

  if ($style -eq 0) {
    # Clean structured listing
    $content = @"
BUSINESS FOR SALE -- $($ind.name.ToUpper())
$($loc.city), $($loc.state)

Listing Price:    $(FormatK $price)
Annual Revenue:   $(FormatK $rev)
SDE / Cash Flow:  $(FormatK $sde)
EBITDA Multiple:  ${mult}x
Years in Business: $yrs
Employees:        $emp
Industry:         $($ind.name)
Location:         $($loc.city), $($loc.state)

BUSINESS OVERVIEW
Established $($ind.name.ToLower()) serving the $($loc.city) metro area for $yrs years.
Seller is retiring and motivated to close. Strong recurring customer base.
All equipment included. Seller will provide 2 weeks of training.

FINANCIALS
Revenue:  $(FormatK $rev)
SDE:      $(FormatK $sde)
Multiple: ${mult}x

Listing Broker: $broker
Firm: $firm
"@
  }
  elseif ($style -eq 1) {
    # Semi-structured with abbreviations
    $revAlt = [int]($rev * ($rng.NextDouble() * 0.05 + 0.97))
    $content = @"
$($ind.name) -- $($loc.city) FL

Price: $(FormatK $price)
Rev: $(FormatKMessy $revAlt)
Owner benefit: $(FormatKMessy $sde)
Established: $([datetime]::Now.Year - $yrs)
Staff: $emp FT employees

Well-established $($ind.name.ToLower()) in $($loc.city). Owner is relocating out of state.
Business has been operating for $yrs years with a loyal customer base.
Asking $(FormatK $price) -- motivated seller.

Contact $broker at $firm for details and NDA.
"@
  }
  elseif ($style -eq 2) {
    # Messy broker text
    $sdeLabel = RandItem @("cashflow","cash flow","seller earnings","owner earnings","owner benefit","discretionary earnings","net to owner","SDE")
    $revLabel  = RandItem @("revenue","gross revenue","gross sales","top line","annual sales","total sales")
    $content = @"
fwd: listing -- $($ind.name) $($loc.city)

hey just wanted to share this one -- solid $($ind.name.ToLower()) in $($loc.city) area

asking $(FormatKMessy $price)
$revLabel $(FormatKMessy $rev)
$sdeLabel $(FormatKMessy $sde)
been around $yrs yrs, $emp employees

owner wants out, health reasons. priced to sell. all assets included.
reach out if interested -- $broker
"@
  }
  elseif ($style -eq 3) {
    # Missing fields
    $missingField = RandInt 0 2
    $priceStr = if ($missingField -eq 0) { "TBD -- contact broker" } else { FormatK $price }
    $sdeStr   = if ($missingField -eq 1) { "available upon NDA" } else { FormatKMessy $sde }
    $revStr   = if ($missingField -eq 2) { "confidential" } else { FormatKMessy $rev }
    $content = @"
$($ind.name) for Sale
Location: $($loc.city), $($loc.state)

Asking Price: $priceStr
Annual Revenue: $revStr
Seller Discretionary Earnings: $sdeStr
Years Operating: $yrs
Employees: $emp

$($ind.name) with $yrs years of operating history in the $($loc.city) market.
Financials available after NDA execution.

Represented by: $broker / $firm
"@
  }
  else {
    # Conflicting numbers
    $revConflict   = [int]($rev   * ($rng.NextDouble() * 0.12 + 0.94))
    $sdeConflict   = [int]($sde   * ($rng.NextDouble() * 0.10 + 0.93))
    $priceConflict = [int]($price * ($rng.NextDouble() * 0.08 + 0.96))
    $content = @"
LISTING SUMMARY
Business: $($ind.name)
Location: $($loc.city), $($loc.state)

Asking Price: $(FormatK $price)
Revenue (TTM): $(FormatK $rev)
SDE: $(FormatK $sde)

DETAILED DESCRIPTION
This $($ind.name.ToLower()) has been generating approximately $(FormatKMessy $revConflict) in annual revenue
with seller earnings of $(FormatKMessy $sdeConflict). The seller is asking $(FormatKMessy $priceConflict)
but may consider reasonable offers. Business has $emp employees and has operated
for $yrs years in the $($loc.city) area.

Note: Financials are unverified. Buyer to confirm during due diligence.
Broker: $broker, $firm
"@
  }

  $filename = "listing_{0:D3}.txt" -f $i
  [System.IO.File]::WriteAllText((Join-Path $listingDir $filename), $content, [System.Text.Encoding]::UTF8)
}

Write-Host "Generated 200 listing files"

# ============================================================
# BROKER EMAILS (50 files)
# ============================================================

$emailDir = Join-Path $root "broker-emails"

for ($i = 1; $i -le 50; $i++) {
  $ind    = RandItem $industries
  $loc    = RandItem $cities
  $rev    = GenRevenue
  $sde    = GenSDE $rev
  $price  = GenPrice $sde
  $broker = MakeBrokerName
  $firm   = RandItem $brokerFirms
  $phone  = MakeBrokerPhone
  $email  = MakeBrokerEmail $broker
  $yrs    = RandInt 3 22
  $emp    = RandInt 2 40

  $hasConflict = RandBool
  $revE   = if ($hasConflict) { [int]($rev   * ($rng.NextDouble() * 0.15 + 0.90)) } else { $rev }
  $sdeE   = if ($hasConflict) { [int]($sde   * ($rng.NextDouble() * 0.12 + 0.91)) } else { $sde }
  $priceE = if ($hasConflict) { [int]($price * ($rng.NextDouble() * 0.10 + 0.93)) } else { $price }

  $style    = RandInt 0 3
  $buyer    = RandItem @("Nathan","Mike","Sarah","David","Jennifer","Tom","Chris","Lisa","Robert","Amy")
  $greeting = RandItem @("Hi","Hello","Hey","Good morning","Good afternoon")
  $subject  = RandItem @(
    "New Listing: $($ind.name) -- $($loc.city)",
    "FWD: $($ind.name) for Sale ($($loc.city))",
    "Thought you'd be interested -- $($ind.name)",
    "Confidential: $($ind.name) Opportunity",
    "RE: $($ind.name) -- Asking $(FormatK $price)"
  )

  if ($style -eq 0) {
    $content = @"
From: $email
To: ${buyer}@dealhub.com
Subject: $subject
Date: $(Get-Date -Format 'ddd, dd MMM yyyy HH:mm:ss')

$greeting $buyer,

I wanted to reach out about a $($ind.name.ToLower()) we just listed in $($loc.city), FL.

Here are the highlights:

  Asking Price:    $(FormatK $priceE)
  Annual Revenue:  $(FormatK $revE)
  SDE / Cash Flow: $(FormatK $sdeE)
  Years in Business: $yrs
  Employees: $emp

The seller has been running this business for $yrs years and is looking to retire.
Strong repeat customer base and excellent reputation in the area.

Please sign the attached NDA to receive the full Confidential Information Memorandum.

Best regards,
$broker
$firm
Direct: $phone
Email: $email
"@
  }
  elseif ($style -eq 1) {
    $content = @"
From: $email
Subject: $subject

$greeting --

Quick note on a $($ind.name.ToLower()) I'm representing in $($loc.city).

Price: $(FormatKMessy $priceE)
Rev: $(FormatKMessy $revE)
Cash flow: $(FormatKMessy $sdeE)
$yrs years established, $emp employees

Owner is motivated -- health reasons. All assets transfer with sale.
Let me know if you want the CIM.

$broker | $firm | $phone
"@
  }
  elseif ($style -eq 2) {
    $content = @"
Subject: $subject
From: $broker <$email>

$greeting $buyer,

Sharing a deal that might fit your criteria -- $($ind.name.ToLower()) in $($loc.city).

The business does around $(FormatKMessy $revE) in revenue and the owner is netting
roughly $(FormatKMessy $sdeE) per year. They're asking $(FormatKMessy $priceE).

It's been operating $yrs years with $emp staff. Very clean books, no deferred maintenance.

Happy to set up a call. NDA required for financials.

Thanks,
$broker
$firm
$phone
$email
"@
  }
  else {
    $content = @"
From: $email

Hey $buyer,

just got this one in -- $($ind.name.ToLower()), $($loc.city) area

asking $(FormatKMessy $priceE), doing $(FormatKMessy $revE) top line, owner making $(FormatKMessy $sdeE)
$yrs yrs old, $emp people

seller wants out fast. reach out if interested

$broker
$phone
"@
  }

  $filename = "email_{0:D3}.txt" -f $i
  [System.IO.File]::WriteAllText((Join-Path $emailDir $filename), $content, [System.Text.Encoding]::UTF8)
}

Write-Host "Generated 50 broker email files"

# ============================================================
# PDF EXTRACTIONS (40 files)
# ============================================================

$pdfDir = Join-Path $root "pdf-extractions"

$ocrSubs = @(
  @{ from="Revenue";       to="Revenu3" },
  @{ from="Seller";        to="Sell3r" },
  @{ from="Earnings";      to="Earn1ngs" },
  @{ from="Discretionary"; to="D1scret1onary" },
  @{ from="Financial";     to="F1nanc1al" },
  @{ from="Business";      to="Bus1ness" },
  @{ from="Annual";        to="Annua1" },
  @{ from="Total";         to="T0tal" },
  @{ from="Income";        to="lncome" },
  @{ from="Operating";     to="0perat1ng" },
  @{ from="Summary";       to="Sumrnary" },
  @{ from="Confidential";  to="Conf1dent1al" },
  @{ from="Information";   to="lnformat1on" },
  @{ from="Transfer";      to="Transf3r" }
)

for ($i = 1; $i -le 40; $i++) {
  $ind   = RandItem $industries
  $loc   = RandItem $cities
  $rev   = GenRevenue
  $sde   = GenSDE $rev
  $price = GenPrice $sde
  $mult  = GenMultiple $price $sde
  $yrs   = RandInt 3 20
  $emp   = RandInt 2 35

  $rev2  = [int]($rev * 0.82)
  $rev3  = [int]($rev * 0.91)
  $sde2  = [int]($sde * 0.80)
  $sde3  = [int]($sde * 0.90)
  $cogs  = [int]($rev * 0.35)
  $gp    = $rev - $cogs
  $opex  = [int]($rev * 0.45)

  $baseText = @"
CONFIDENTIAL INFORMATION MEMORANDUM

$($ind.name.ToUpper())
$($loc.city), $($loc.state)

EXECUTIVE SUMMARY

This Confidential Information Memorandum has been prepared to assist prospective
buyers in evaluating the acquisition of a $($ind.name.ToLower()) located in $($loc.city), $($loc.state).

BUSINESS OVERVIEW

The Business has been in operation for $yrs years and employs $emp full-time
equivalent employees. The Seller is seeking to retire after building a
successful and profitable enterprise.

FINANCIAL SUMMARY

Fiscal Year Financial Performance:

  Annual Revenue:                $("{0:N0}" -f $rev)
  Cost of Goods Sold:            $("{0:N0}" -f $cogs)
  Gross Profit:                  $("{0:N0}" -f $gp)
  Operating Expenses:            $("{0:N0}" -f $opex)
  Seller Discretionary Earnings: $("{0:N0}" -f $sde)

VALUATION

  Asking Price:    $("{0:N0}" -f $price)
  SDE Multiple:    ${mult}x
  Employees:       $emp
  Years Operating: $yrs

FINANCIAL TABLE (EXTRACTED FROM PDF)

Year    Revenue         SDE             Margin
----    -------         ---             ------
2022    $("{0:N0}" -f $rev2)    $("{0:N0}" -f $sde2)   $([math]::Round($sde2/$rev2*100,1))%
2023    $("{0:N0}" -f $rev3)      $("{0:N0}" -f $sde3)  $([math]::Round($sde3/$rev3*100,1))%
2024  $("{0:N0}" -f $rev)   $("{0:N0}" -f $sde)    $([math]::Round($sde/$rev*100,1))%

ASSETS INCLUDED

All equipment, vehicles, customer lists, trade name, phone numbers,
and goodwill transfer with the sale. Real estate is leased.

TRANSITION

Seller will provide up to 90 days of transition assistance.
"@

  # Apply OCR substitutions
  $errorCount = RandInt 2 5
  $corrupted = $baseText
  $selectedErrors = $ocrSubs | Get-Random -Count $errorCount
  foreach ($err in $selectedErrors) {
    $corrupted = $corrupted -replace $err.from, $err.to
  }

  # Break comma separators in numbers (common OCR issue)
  if (RandBool) {
    $corrupted = $corrupted -replace '(\d),(\d{3})', '$1 $2'
  }

  # Add random spacing errors
  if (RandBool) {
    $corrupted = $corrupted -replace '(\d)\s{2,}(\d)', '$1  $2'
  }

  $filename = "pdf_extract_{0:D3}.txt" -f $i
  [System.IO.File]::WriteAllText((Join-Path $pdfDir $filename), $corrupted, [System.Text.Encoding]::UTF8)
}

Write-Host "Generated 40 PDF extraction files"

# ============================================================
# FINANCIALS (20 files)
# ============================================================

$finDir = Join-Path $root "financials"

for ($i = 1; $i -le 20; $i++) {
  $ind   = RandItem $industries
  $loc   = RandItem $cities

  $rev24 = GenRevenue
  $rev23 = [int]($rev24 * ($rng.NextDouble() * 0.12 + 0.82))
  $rev22 = [int]($rev23 * ($rng.NextDouble() * 0.12 + 0.82))
  $rev21 = [int]($rev22 * ($rng.NextDouble() * 0.10 + 0.84))

  $sde24 = GenSDE $rev24
  $sde23 = [int]($sde24 * ($rng.NextDouble() * 0.12 + 0.82))
  $sde22 = [int]($sde23 * ($rng.NextDouble() * 0.12 + 0.82))
  $sde21 = [int]($sde22 * ($rng.NextDouble() * 0.10 + 0.84))

  $cogs24 = [int]($rev24 * ($rng.NextDouble() * 0.10 + 0.30))
  $cogs23 = [int]($rev23 * ($rng.NextDouble() * 0.10 + 0.30))
  $cogs22 = [int]($rev22 * ($rng.NextDouble() * 0.10 + 0.30))
  $cogs21 = [int]($rev21 * ($rng.NextDouble() * 0.10 + 0.30))

  $opex24 = [math]::Max(0, $rev24 - $cogs24 - $sde24)
  $opex23 = [math]::Max(0, $rev23 - $cogs23 - $sde23)
  $opex22 = [math]::Max(0, $rev22 - $cogs22 - $sde22)
  $opex21 = [math]::Max(0, $rev21 - $cogs21 - $sde21)

  $yoy2223 = [math]::Round(($rev23-$rev22)/$rev22*100,1)
  $yoy2324 = [math]::Round(($rev24-$rev23)/$rev23*100,1)
  $sdeyoy2223 = [math]::Round(($sde23-$sde22)/$sde22*100,1)
  $sdeyoy2324 = [math]::Round(($sde24-$sde23)/$sde23*100,1)

  $style = RandInt 0 2

  if ($style -eq 0) {
    $content = @"
$($ind.name.ToUpper()) -- FINANCIAL SUMMARY
$($loc.city), $($loc.state)
Prepared for Buyer Review -- Confidential

PROFIT AND LOSS STATEMENT (UNAUDITED)

                          2021          2022          2023          2024
                          ----          ----          ----          ----
Revenue               $("{0:N0}" -f $rev21)    $("{0:N0}" -f $rev22)    $("{0:N0}" -f $rev23)    $("{0:N0}" -f $rev24)
Cost of Goods Sold    $("{0:N0}" -f $cogs21)    $("{0:N0}" -f $cogs22)    $("{0:N0}" -f $cogs23)    $("{0:N0}" -f $cogs24)
Gross Profit          $("{0:N0}" -f ($rev21-$cogs21))    $("{0:N0}" -f ($rev22-$cogs22))    $("{0:N0}" -f ($rev23-$cogs23))    $("{0:N0}" -f ($rev24-$cogs24))
Operating Expenses    $("{0:N0}" -f $opex21)    $("{0:N0}" -f $opex22)    $("{0:N0}" -f $opex23)    $("{0:N0}" -f $opex24)
SDE                   $("{0:N0}" -f $sde21)    $("{0:N0}" -f $sde22)    $("{0:N0}" -f $sde23)    $("{0:N0}" -f $sde24)

SDE Margin            $([math]::Round($sde21/$rev21*100,1))%          $([math]::Round($sde22/$rev22*100,1))%          $([math]::Round($sde23/$rev23*100,1))%          $([math]::Round($sde24/$rev24*100,1))%

NOTES:
- Owner salary addback: included in SDE calculation
- Depreciation addback: included
- One-time expenses removed from 2022 and 2023
- Figures are unaudited and subject to verification
"@
  }
  elseif ($style -eq 1) {
    $content = @"
$($ind.name) -- 3-Year Financials

Year    Revenue         SDE             COGS            Op Expenses
2022    $("{0:N0}" -f $rev22)    $("{0:N0}" -f $sde22)    $("{0:N0}" -f $cogs22)    $("{0:N0}" -f $opex22)
2023    $("{0:N0}" -f $rev23)    $("{0:N0}" -f $sde23)    $("{0:N0}" -f $cogs23)    $("{0:N0}" -f $opex23)
2024    $("{0:N0}" -f $rev24)    $("{0:N0}" -f $sde24)    $("{0:N0}" -f $cogs24)    $("{0:N0}" -f $opex24)

YoY Revenue Growth:
  2022 to 2023: ${yoy2223}%
  2023 to 2024: ${yoy2324}%

YoY SDE Growth:
  2022 to 2023: ${sdeyoy2223}%
  2023 to 2024: ${sdeyoy2324}%

TTM SDE: $("{0:N0}" -f $sde24)
Location: $($loc.city), $($loc.state)
"@
  }
  else {
    $addback1 = [int]($sde24 * 0.60)
    $addback2 = [int]($sde24 * 0.15)
    $addback3 = [int]($sde24 * 0.25)
    $addback1_22 = [int]($sde22 * 0.60)
    $addback2_22 = [int]($sde22 * 0.15)
    $addback3_22 = [int]($sde22 * 0.25)
    $addback1_23 = [int]($sde23 * 0.60)
    $addback2_23 = [int]($sde23 * 0.15)
    $addback3_23 = [int]($sde23 * 0.25)
    $ni22 = $rev22 - $cogs22 - $opex22
    $ni23 = $rev23 - $cogs23 - $opex23
    $ni24 = $rev24 - $cogs24 - $opex24
    $content = @"
Recast P&L -- $($ind.name)
$($loc.city) FL

                    FY2022          FY2023          FY2024
Gross Revenue       $("{0:N0}" -f $rev22)      $("{0:N0}" -f $rev23)      $("{0:N0}" -f $rev24)
Less: COGS         ($("{0:N0}" -f $cogs22))    ($("{0:N0}" -f $cogs23))    ($("{0:N0}" -f $cogs24))
Gross Profit        $("{0:N0}" -f ($rev22-$cogs22))      $("{0:N0}" -f ($rev23-$cogs23))      $("{0:N0}" -f ($rev24-$cogs24))
Less: Op Expenses  ($("{0:N0}" -f $opex22))    ($("{0:N0}" -f $opex23))    ($("{0:N0}" -f $opex24))
Net Income          $("{0:N0}" -f $ni22)      $("{0:N0}" -f $ni23)      $("{0:N0}" -f $ni24)
Add: Owner Salary   $("{0:N0}" -f $addback1_22)      $("{0:N0}" -f $addback1_23)      $("{0:N0}" -f $addback1)
Add: Depreciation   $("{0:N0}" -f $addback2_22)      $("{0:N0}" -f $addback2_23)      $("{0:N0}" -f $addback2)
Add: One-Time Items $("{0:N0}" -f $addback3_22)      $("{0:N0}" -f $addback3_23)      $("{0:N0}" -f $addback3)
                    --------        --------        --------
Recast SDE          $("{0:N0}" -f $sde22)      $("{0:N0}" -f $sde23)      $("{0:N0}" -f $sde24)

Prepared by seller's accountant. Not audited.
"@
  }

  $filename = "financials_{0:D3}.txt" -f $i
  [System.IO.File]::WriteAllText((Join-Path $finDir $filename), $content, [System.Text.Encoding]::UTF8)
}

Write-Host "Generated 20 financial files"

# ============================================================
# NDAs (10 files)
# ============================================================

$ndaDir = Join-Path $root "nda"

$ndaScenarios = @(
  @{ signed=$true;  style="docusign";   label="signed_docusign" },
  @{ signed=$true;  style="wet_ink";    label="signed_wet" },
  @{ signed=$true;  style="electronic"; label="signed_electronic" },
  @{ signed=$false; style="blank";      label="unsigned_blank" },
  @{ signed=$false; style="blank";      label="unsigned_template" },
  @{ signed=$true;  style="docusign";   label="signed_executed" },
  @{ signed=$false; style="partial";    label="unsigned_partial" },
  @{ signed=$true;  style="wet_ink";    label="signed_countersigned" },
  @{ signed=$false; style="blank";      label="unsigned_draft" },
  @{ signed=$true;  style="electronic"; label="signed_adobe" }
)

for ($i = 0; $i -lt 10; $i++) {
  $scenario = $ndaScenarios[$i]
  $ind      = RandItem $industries
  $loc      = RandItem $cities
  $buyer    = MakeBrokerName
  $seller   = MakeBrokerName
  $broker   = MakeBrokerName
  $firm     = RandItem $brokerFirms
  $date     = (Get-Date).AddDays(-($rng.Next(10,180))).ToString("MMMM d, yyyy")
  $envId    = [guid]::NewGuid().ToString().ToUpper()

  if ($scenario.signed) {
    if ($scenario.style -eq "docusign") {
      $sigBlock = @"

SIGNATURE PAGE

This Agreement has been executed as of the date first written above.

RECEIVING PARTY:

Signature: /s/ $buyer
Name: $buyer
Date: $date
Title: Prospective Buyer

DISCLOSING PARTY:

Signature: /s/ $seller
Name: $seller
Date: $date
Title: Owner / Seller

---
DocuSign Envelope ID: $envId
Electronically signed via DocuSign
Certificate of Completion attached
Status: COMPLETED
"@
    }
    elseif ($scenario.style -eq "wet_ink") {
      $sigBlock = @"

SIGNATURE PAGE

RECEIVING PARTY:

Signature: [signed]
Printed Name: $buyer
Date Signed: $date
Title: Buyer

DISCLOSING PARTY:

Signature: [signed]
Printed Name: $seller
Date Signed: $date
Title: Seller / Owner

Executed by both parties on $date.
"@
    }
    else {
      $sigBlock = @"

EXECUTED AGREEMENT

Signed electronically by:

$buyer (Receiving Party) -- $date
Adobe Sign Transaction ID: $envId

$seller (Disclosing Party) -- $date
Adobe Sign Transaction ID: $envId

This document has been electronically signed and is legally binding.
"@
    }
  }
  else {
    if ($scenario.style -eq "blank") {
      $sigBlock = @"

SIGNATURE PAGE

RECEIVING PARTY:

Signature: _______________________________
Printed Name: _______________________________
Date: _______________________________
Title: _______________________________

DISCLOSING PARTY:

Signature: _______________________________
Printed Name: _______________________________
Date: _______________________________
Title: _______________________________
"@
    }
    elseif ($scenario.style -eq "partial") {
      $sigBlock = @"

SIGNATURE PAGE

RECEIVING PARTY:

Signature: _______________________________
Printed Name: $buyer
Date: _______________________________
Title: Prospective Buyer

DISCLOSING PARTY:

Signature: _______________________________
Printed Name: _______________________________
Date: _______________________________
Title: _______________________________

NOTE: This NDA has not yet been countersigned by the Disclosing Party.
"@
    }
    else {
      $sigBlock = @"

[SIGNATURE PAGE TO FOLLOW]

[INSERT BUYER NAME]
[INSERT DATE]
[INSERT TITLE]

[INSERT SELLER NAME]
[INSERT DATE]
[INSERT TITLE]
"@
    }
  }

  $content = @"
NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement ("Agreement") is entered into as of $date, by and between:

Disclosing Party: $seller ("Seller"), owner of a $($ind.name.ToLower()) located in $($loc.city), $($loc.state), and

Receiving Party: $buyer ("Buyer"), a prospective purchaser.

RECITALS

WHEREAS, the Disclosing Party desires to disclose certain confidential information
relating to the potential sale of the Business to the Receiving Party for the purpose
of evaluating a potential acquisition transaction (the "Transaction"); and

WHEREAS, the Receiving Party desires to receive such confidential information subject
to the terms and conditions set forth herein.

NOW, THEREFORE, in consideration of the mutual covenants contained herein, the parties
agree as follows:

1. CONFIDENTIAL INFORMATION

"Confidential Information" means any and all information disclosed by the Disclosing
Party to the Receiving Party relating to the Business, including but not limited to:
financial statements, customer lists, employee information, trade secrets, pricing,
contracts, and any other proprietary business information.

2. OBLIGATIONS OF RECEIVING PARTY

The Receiving Party agrees to:
(a) Hold all Confidential Information in strict confidence;
(b) Not disclose Confidential Information to any third party without prior written consent;
(c) Use Confidential Information solely for the purpose of evaluating the Transaction;
(d) Protect Confidential Information with the same degree of care used for its own
    confidential information, but in no event less than reasonable care.

3. TERM

This Agreement shall remain in effect for a period of two (2) years from the date
of execution.

4. RETURN OF INFORMATION

Upon request, the Receiving Party shall promptly return or destroy all Confidential
Information and any copies thereof.

5. REMEDIES

The parties acknowledge that breach of this Agreement would cause irreparable harm
and that monetary damages would be inadequate. The Disclosing Party shall be entitled
to seek injunctive relief in addition to any other remedies available at law or equity.

6. GOVERNING LAW

This Agreement shall be governed by the laws of the State of Florida.

Represented by: $broker, $firm
$sigBlock
"@

  $filename = "nda_{0:D2}_{1}.txt" -f ($i+1), $scenario.label
  [System.IO.File]::WriteAllText((Join-Path $ndaDir $filename), $content, [System.Text.Encoding]::UTF8)
}

Write-Host "Generated 10 NDA files"

# ============================================================
# MULTI-FILE DEALS (20 folders)
# ============================================================

$multiDir = Join-Path $root "multi-file-deals"

for ($i = 1; $i -le 20; $i++) {
  $ind    = RandItem $industries
  $loc    = RandItem $cities
  $broker = MakeBrokerName
  $firm   = RandItem $brokerFirms
  $phone  = MakeBrokerPhone
  $emailAddr = MakeBrokerEmail $broker
  $yrs    = RandInt 4 20
  $emp    = RandInt 3 40

  $revBase   = GenRevenue
  $sdeBase   = GenSDE $revBase
  $priceBase = GenPrice $sdeBase
  $multBase  = GenMultiple $priceBase $sdeBase

  # Deliberate discrepancies across files
  $revEmail   = [int]($revBase   * ($rng.NextDouble() * 0.14 + 0.90))
  $sdeEmail   = [int]($sdeBase   * ($rng.NextDouble() * 0.14 + 0.90))
  $priceEmail = [int]($priceBase * ($rng.NextDouble() * 0.10 + 0.93))

  $revFin  = [int]($revBase  * ($rng.NextDouble() * 0.06 + 0.97))
  $sdeFin  = [int]($sdeBase  * ($rng.NextDouble() * 0.06 + 0.97))

  $dealFolder = Join-Path $multiDir ("deal-{0:D3}" -f $i)
  New-Item -ItemType Directory -Force -Path $dealFolder | Out-Null

  # listing.txt
  $listing = @"
BUSINESS FOR SALE
$($ind.name) -- $($loc.city), $($loc.state)

Asking Price:    $(FormatK $priceBase)
Annual Revenue:  $(FormatK $revBase)
SDE:             $(FormatK $sdeBase)
Multiple:        ${multBase}x
Years in Business: $yrs
Employees: $emp

$($ind.name) with $yrs years of operating history serving the $($loc.city) market.
Seller is motivated. All assets included. Lease transferable.

Broker: $broker | $firm
"@
  [System.IO.File]::WriteAllText((Join-Path $dealFolder "listing.txt"), $listing, [System.Text.Encoding]::UTF8)

  # email.txt
  $emailContent = @"
From: $emailAddr
Subject: $($ind.name) -- $($loc.city) -- Confidential

Hi,

Following up on the $($ind.name.ToLower()) listing in $($loc.city).

The seller has updated the numbers slightly:
  Revenue:  $(FormatKMessy $revEmail)
  Cash Flow: $(FormatKMessy $sdeEmail)
  Asking:   $(FormatKMessy $priceEmail)

These reflect the most recent trailing twelve months.
Please sign the NDA to receive the full CIM.

$broker
$firm | $phone
"@
  [System.IO.File]::WriteAllText((Join-Path $dealFolder "email.txt"), $emailContent, [System.Text.Encoding]::UTF8)

  # financials.txt
  $rev22f  = [int]($revFin * 0.82)
  $rev23f  = [int]($revFin * 0.91)
  $sde22f  = [int]($sdeFin * 0.80)
  $sde23f  = [int]($sdeFin * 0.90)
  $cogs22f = [int]($rev22f * 0.33)
  $cogs23f = [int]($rev23f * 0.33)
  $cogs24f = [int]($revFin * 0.33)

  $financials = @"
$($ind.name) -- Financial Summary
$($loc.city), $($loc.state)

Year    Revenue         SDE             COGS
2022    $("{0:N0}" -f $rev22f)    $("{0:N0}" -f $sde22f)    $("{0:N0}" -f $cogs22f)
2023    $("{0:N0}" -f $rev23f)    $("{0:N0}" -f $sde23f)    $("{0:N0}" -f $cogs23f)
2024    $("{0:N0}" -f $revFin)    $("{0:N0}" -f $sdeFin)    $("{0:N0}" -f $cogs24f)

TTM Revenue: $("{0:N0}" -f $revFin)
TTM SDE:     $("{0:N0}" -f $sdeFin)

Note: Figures are seller-prepared and unaudited.
Buyer should verify during due diligence.
"@
  [System.IO.File]::WriteAllText((Join-Path $dealFolder "financials.txt"), $financials, [System.Text.Encoding]::UTF8)

  # expected.json (ground truth for fact reconciliation testing)
  $revConflict   = ($revBase -ne $revEmail) -or ($revBase -ne $revFin)
  $sdeConflict   = ($sdeBase -ne $sdeEmail) -or ($sdeBase -ne $sdeFin)
  $priceConflict = ($priceBase -ne $priceEmail)

  $expectedJson = @"
{
  "deal_number": $i,
  "industry": "$($ind.name)",
  "location": "$($loc.city), $($loc.state)",
  "broker_name": "$broker",
  "broker_firm": "$firm",
  "broker_phone": "$phone",
  "years_in_business": $yrs,
  "employees": $emp,
  "listing": {
    "asking_price": $priceBase,
    "revenue": $revBase,
    "sde": $sdeBase,
    "multiple": $multBase
  },
  "email": {
    "asking_price": $priceEmail,
    "revenue": $revEmail,
    "sde": $sdeEmail
  },
  "financials": {
    "revenue_ttm": $revFin,
    "sde_ttm": $sdeFin,
    "revenue_2022": $rev22f,
    "revenue_2023": $rev23f,
    "sde_2022": $sde22f,
    "sde_2023": $sde23f
  },
  "expected_conflicts": {
    "revenue": $(if ($revConflict) { "true" } else { "false" }),
    "sde": $(if ($sdeConflict) { "true" } else { "false" }),
    "price": $(if ($priceConflict) { "true" } else { "false" })
  },
  "notes": "Revenue in email differs from listing by $([math]::Abs($revBase - $revEmail) | ForEach-Object { [math]::Round($_ / $revBase * 100, 1) })%. SDE in email differs by $([math]::Abs($sdeBase - $sdeEmail) | ForEach-Object { [math]::Round($_ / $sdeBase * 100, 1) })%."
}
"@
  [System.IO.File]::WriteAllText((Join-Path $dealFolder "expected.json"), $expectedJson, [System.Text.Encoding]::UTF8)
}

Write-Host "Generated 20 multi-file deal folders (4 files each)"
Write-Host ""
Write-Host "=== Generation complete ==="
Write-Host "  listings/           200 files"
Write-Host "  broker-emails/       50 files"
Write-Host "  pdf-extractions/     40 files"
Write-Host "  financials/          20 files"
Write-Host "  nda/                 10 files"
Write-Host "  multi-file-deals/    20 folders x 4 files = 80 files"
Write-Host "  Total:              400 files"
