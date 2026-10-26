# TV Home — an Apple TV-style home screen for your TCL TV

A clean, fast home screen for TCL Google TV / Android TV sets, with:

- **Big clock, date and greeting**, plus weather for two cities and a "what to wear" tip
  (e.g. *Light jacket · cools to 53° by 10 PM*).
- **Living wallpaper**: snowy mountains whose sky follows the real sun, from dawn to stars.
  Or a slideshow of your own photo links.
- **Clutter-free dock**: up to 7 favourite apps with big banners, plus All apps, Draw, Ask and Appearance.
- **Voice assistant powered by Claude**: "Play lo-fi on YouTube", "Set a pasta timer for 10 minutes",
  "Pin a note saying dinner at 7", "What should we watch tonight?". Simple commands work offline.
- **Draw on the screen** with the remote, a mouse, or live from your phone. Pin drawings to the home screen.
- **Phone remote**: open the TV's address on your phone to draw, send notes, ask the assistant,
  use a D-pad, launch apps and set things up without typing on the TV.
- **Extras**: ambient mode when idle, warm night dimming 10 PM–6 AM, on-screen timers with chimes,
  sticky notes that expire, accent colours, remote colour-button shortcuts.

```
tcl-tv-home/
  web/        The home screen itself (HTML/CSS/JS). Runs in any browser for preview.
  android/    Small Android TV app that shows the web folder full screen and adds
              app launching, voice, speech, remote buttons and the phone server.
  tools/      Rebuilds web/vendor/anthropic.mjs (the Claude SDK bundle).
```

---

## Step 0 — Check which TCL you have

Press **Home** on the TCL remote and look at the screen.

| You see | System | Works? |
|---|---|---|
| "Google TV" with *For you / Apps* tabs | Google TV | Yes |
| "Android TV" home with app rows | Android TV | Yes |
| Purple "Roku" home | Roku TV | No. Roku can't install apps. Plug in a cheap Google TV stick (Chromecast with Google TV, Google TV Streamer, onn 4K) and use that. |
| "Fire TV" home | Fire TV | Mostly. Sideloading works the same way. |

## Step 1 — Get the APK

The APK is built automatically by GitHub Actions every time this folder changes.

1. Open the repository on GitHub and go to **Actions → Build TV Home APK**.
2. Open the newest green run and download the **tv-home-apk** artifact (a zip).
3. Unzip it. You get **tv-home.apk**.

To build it yourself instead: install Android Studio, open the `tcl-tv-home/android` folder and press
**Build → Build APK(s)**. Or from a terminal with Gradle 8.14 and the Android SDK:

```bash
gradle -p tcl-tv-home/android assembleDebug
# APK: tcl-tv-home/android/app/build/outputs/apk/debug/app-debug.apk
```

## Step 2 — Allow installing apps on the TV

1. **Settings → System → About**. Scroll to **Android TV OS build** and click it **7 times**
   until it says you are a developer.
2. **Settings → System → Developer options**: turn on **USB debugging** (needed for Option B and Step 5).
3. Option A below will ask you to allow "install unknown apps" for the app you use. Say yes.

## Step 3 — Install the APK on the TV

**Option A, easiest: phone to TV.**
Install **Send Files to TV** on both your phone and the TV from the Play Store.
Send `tv-home.apk` from the phone, then open it on the TV and press **Install**.

**Option B, from a computer with ADB.**
Install [Android platform-tools](https://developer.android.com/tools/releases/platform-tools).
Find the TV's IP in **Settings → Network & Internet → your Wi-Fi**.

```bash
adb connect 192.168.1.50        # your TV's IP; accept the prompt on the TV
adb install -r tv-home.apk
```

**Option C, USB stick.** Copy the APK to a USB drive, plug it into the TV and open it with a file manager
app such as *File Commander* or *X-plore*.

Updates install the same way. Every build uses the same signing key, so a new APK replaces the old one
and keeps your settings.

## Step 4 — First launch and setup

1. Open **TV Home** from your apps list.
2. Go right to **Appearance** (the picture icon) and press OK.
3. Fill in your name and cities. Pick 12/24-hour, °F/°C, wallpaper, accent and ambient timing.
4. Choose **Choose dock apps** to pick and order up to 7 favourite apps.
5. **Claude API key** for the assistant: create one at <https://console.anthropic.com>
   (Settings → API keys). Typing it with a remote is painful, so use the phone remote instead:
   - Note the **Phone remote** address and PIN at the bottom of Appearance, e.g. `http://192.168.1.50:8765`, PIN `4821`.
   - Open that address on your phone (same Wi-Fi), enter the PIN, go to **Setup**, paste the key, **Save to TV**.

The key is stored only on the TV. The assistant uses the `claude-opus-5-5` model at low effort for quick
spoken answers. Expect roughly one to two US cents per question.

## Step 5 — Make it the real Home button

Google TV does not let you pick a different home app in Settings. Choose one of these.

**Option A, safe and reversible: remap the Home button.**
Install **Button Mapper** from the Play Store, give it the accessibility permission it asks for, then set
**Home → single press → Open app → TV Home**. Leave other buttons as they are.

**Option B, replace the stock launcher with ADB.**
This disables Google's home screen so Android falls back to TV Home. Keep a computer handy to undo it.

```bash
adb connect 192.168.1.50
adb shell pm list packages | grep -i launcher            # see what your TV uses
# Google TV:
adb shell pm disable-user --user 0 com.google.android.apps.tv.launcherx
adb shell pm disable-user --user 0 com.google.android.tungsten.setupwraith
# Older Android TV instead:
# adb shell pm disable-user --user 0 com.google.android.tvlauncher
```

Press Home and choose **TV Home → Always** if asked. To undo it:

```bash
adb shell pm enable com.google.android.apps.tv.launcherx
adb shell pm enable com.google.android.tungsten.setupwraith
```

Some TCL firmware brings the stock launcher back after a system update. Run the commands again if that happens.
Disabling the launcher also hides Google's "Continue watching" rows and the profile switcher.

## Step 6 — Make the TV feel faster

These are optional and reversible.

- **Developer options**: set *Window animation scale*, *Transition animation scale* and
  *Animator duration scale* to **0.5x**.
- **Settings → Apps**: uninstall or disable apps you never use, especially preinstalled ones.
- **Settings → Privacy → Usage & diagnostics**: off. Turn off *Ads personalisation* too.
- **TCL-specific**: turn off *Instant Power On*'s "Voice wake" if you don't use it, and disable
  *TCL Channel* or *Home Shopping* style apps in **Settings → Apps → See all apps → Disable**.
- Restart the TV once a week (hold the power button → Restart). It clears memory leaks from streaming apps.

---

## Using it

| Remote | Home | Draw mode | Assistant |
|---|---|---|---|
| Arrows | Move focus | Move the pen cursor (hold to speed up) | Move between buttons |
| OK | Open | Pen down / pen up | Ask again |
| Back | — | Open tools; Back again leaves | Close |
| 1–9 / 0 | — | Pick a colour / clear | — |
| Red / Green / Yellow / Blue | Draw / Assistant / Appearance / Ambient | | |
| Search or mic button* | Assistant | | |

\*On most Google TV remotes the mic button always opens Google Assistant. Use the **Ask** tile, the
green button, or remap the mic button with Button Mapper.

**Voice examples**: "Open Netflix" · "Play relaxing jazz on YouTube" · "Set a 15 minute timer for homework" ·
"Pin a note saying the plumber comes at 3" · "Draw" · "Clear notes" · "Ambient mode" ·
"What's a good family movie tonight?".

**Notes on the home screen** stack on the right. Arrow up from the dock to reach them; OK dismisses one.

**Photo wallpaper**: in Appearance, switch Wallpaper to *Photos* and paste direct image links, one per line.
Links must point straight at an image file.

## Previewing and changing the design on a computer

The `web` folder runs in any browser, with demo apps and browser speech instead of Android's:

```bash
python3 -m http.server 8000 -d tcl-tv-home/web
# open http://localhost:8000 and use the arrow keys, Enter and Esc
```

Change `web/styles.css` for the look, `web/js/wallpaper.js` for the scenery and `web/js/assistant.js`
for the assistant's personality and tools. Rebuild the APK to put your changes on the TV.

To update the bundled Claude SDK:

```bash
cd tcl-tv-home/tools && npm install && npm run bundle
```

## Privacy and security

- Settings, notes and your API key stay in the TV app's storage. Nothing is sent anywhere except
  weather lookups to Open-Meteo and assistant questions to the Claude API.
- The phone remote only listens on your home network and every command needs the 4-digit PIN.
  Don't forward port 8765 on your router.

## Troubleshooting

| Problem | Fix |
|---|---|
| "App not installed" | Uninstall any older TV Home first, then install again. |
| Voice says it isn't available | Make sure the *Google* app is installed and up to date; it provides speech recognition. |
| No weather | Check the city name in Appearance and the TV's internet connection. |
| Phone can't connect | Phone and TV must be on the same Wi-Fi. Some routers block "client isolation"; turn that off for your home network. |
| An app opens but shows the wrong page | Some apps ignore deep links. "Open X" always works. |
| Assistant says the key was rejected | Re-paste the key from the phone remote's Setup tab. |
