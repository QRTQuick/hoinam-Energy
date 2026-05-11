import os
import sys
from pathlib import Path
import pymupdf  # This is the PyMuPDF library

def run_converter():
    print("--- PDF to PNG Converter (No Poppler Needed) ---")
    
    # 1. Get input path
    input_raw = input("Paste the path to your PDF file: ").strip()
    # Clean up quotes if user used 'Copy as Path'
    input_path = input_raw.replace('"', '').replace("'", "")
    
    pdf_path = Path(input_path)

    # 2. Validation
    if not pdf_path.is_file():
        print(f"Error: Could not find file at {pdf_path}")
        return
    
    if pdf_path.suffix.lower() != ".pdf":
        print("Error: The file selected is not a PDF.")
        return

    try:
        # 3. Open the PDF
        doc = pymupdf.open(pdf_path)
        
        # Create output folder
        output_folder = pdf_path.parent / f"{pdf_path.stem}_images"
        if not output_folder.exists():
            output_folder.mkdir()

        print(f"Converting {doc.page_count} pages...")

        # 4. Loop through pages and save as PNG
        for page_index in range(len(doc)):
            page = doc[page_index]
            
            # Increase resolution (matrix). 2.0 = 2x zoom (sharper image)
            zoom = 2.0 
            mat = pymupdf.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=mat)
            
            output_filename = output_folder / f"page_{page_index + 1}.png"
            pix.save(str(output_filename))
            print(f"Saved: {output_filename.name}")

        doc.close()
        print(f"\nSuccess! Images saved in: {output_folder}")

    except Exception as e:
        print(f"\nAn error occurred: {e}")

if __name__ == "__main__":
    run_converter()
    input("\nPress Enter to exit...")
    