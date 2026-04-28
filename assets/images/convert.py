import os
import sys
from pathlib import Path
from pdf2image import convert_from_path

def run_converter():
    print("--- PDF to PNG Converter ---")
    
    # 1. Ask user for the file path
    # We strip quotes in case the user copies the path as "C:\path\file.pdf"
    input_path = input("Paste the path to your PDF file: ").strip().replace('"', '').replace("'", "")
    
    path = Path(input_path)

    # 2. Validation
    if not path.is_file():
        print(f"Error: Could not find file at {path}")
        return
    
    if path.suffix.lower() != ".pdf":
        print("Error: The file selected is not a PDF.")
        return

    # 3. Execution
    try:
        print(f"Converting '{path.name}'...")
        
        # Convert PDF to list of PIL Image objects
        # Note: If poppler is not in PATH, you can specify path here:
        # pages = convert_from_path(input_path, poppler_path=r'C:\path\to\poppler\bin')
        pages = convert_from_path(input_path)

        # Create an output folder based on the filename
        output_folder = path.parent / f"{path.stem}_images"
        if not output_folder.exists():
            output_folder.mkdir()

        for i, page in enumerate(pages):
            output_filename = output_folder / f"page_{i + 1}.png"
            page.save(output_filename, "PNG")
            print(f"Saved: {output_filename.name}")

        print(f"\nDone! All images are in: {output_folder}")

    except Exception as e:
        print(f"\nAn error occurred: {e}")
        print("\nNote: Make sure 'Poppler' is installed and added to your System PATH.")

if __name__ == "__main__":
    run_converter()
    input("\nPress Enter to exit...") # Keeps terminal open when running as EXE