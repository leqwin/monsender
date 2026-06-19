# Privacy policy

monloader-browser collects nothing and sends nothing to anyone except the
monloader server you configure.

- No analytics, no telemetry, no remote code. All code ships in the extension
  package.
- The only network requests the extension makes are to the monloader URL you
  set in its options. It never contacts monbooru directly, and never any
  third-party server.
- What is sent to your monloader: the URL you choose to send (the page, a
  right-clicked target, or images you pick from a page scan) and, if you set
  one, your monloader API token as a bearer header.
- The page URL and the page DOM are read only when you act (click the toolbar
  button, use the keyboard shortcut, pick a context-menu item, or run a scan),
  under the `activeTab` permission. Nothing is read in the background.
- Your settings (monloader URL, token, preferences) are stored locally in the
  browser (`storage.local`). 
