# App Android (TWA)

`twa-manifest.json` define la app Android de SOLYSOMBRA. Cualquier cambio en esta
carpeta lanza la compilación automática (`.github/workflows/android.yml`).
El AAB y la APK firmados aparecen en la rama `builds`.

Para sacar una versión nueva para Play Store, sube `appVersionCode` (+1) y
`appVersionName` en `twa-manifest.json`.
