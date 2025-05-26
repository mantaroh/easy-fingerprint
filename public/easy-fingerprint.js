(async () => {
  const { default: FingerprintJS } = await import(
    'https://cdn.jsdelivr.net/npm/@fingerprintjs/fingerprintjs@4.6.2/+esm'
  );

  const fp = await FingerprintJS.load();
  const { visitorId } = await fp.get();

  navigator.sendBeacon(
    'https://easy-fingerprint.mantaroh.workers.dev/',
    JSON.stringify({
      id   : visitorId,
      ua   : navigator.userAgent,
      lang : navigator.language,
      tz   : Intl.DateTimeFormat().resolvedOptions().timeZone
    })
  );
})();