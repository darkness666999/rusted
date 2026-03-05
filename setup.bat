@echo off
REM ------------------------------
REM Windows setup: clean and decompress binaries
REM ------------------------------

SET ZIP_PATH=src-tauri\binaries\ffmpeg.zip
SET DEST_PATH=src-tauri\binaries

REM Check if zip exists
IF NOT EXIST "%ZIP_PATH%" (
    echo ERROR: Zip file not found: %ZIP_PATH%
    pause
    exit /b 1
)

REM Remove old binaries except the zip itself
echo Cleaning old binaries...
for /D %%D in ("%DEST_PATH%\*") do rd /s /q "%%D"
for %%F in ("%DEST_PATH%\*") do (
    if /I not "%%~nxF"=="ffmpeg.zip" del /q "%%F"
)

REM Create destination folder if it doesn't exist
IF NOT EXIST "%DEST_PATH%" (
    mkdir "%DEST_PATH%"
)

echo Extracting binaries from %ZIP_PATH% to %DEST_PATH%...
powershell -Command "Expand-Archive -Force '%ZIP_PATH%' '%DEST_PATH%'"

IF %ERRORLEVEL% NEQ 0 (
    echo Extraction failed.
    pause
    exit /b 1
)

echo Extraction complete!
pause