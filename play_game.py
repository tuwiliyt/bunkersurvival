#!/usr/bin/env python3
"""
Launcher for BUNKER PROTOCOL: 2D Zombie Survival Defense
Usage:
  In Python / Colab Notebook:
    import play_game
    play_game.show()

  From Terminal:
    python3 /content/play_game.py
"""
import os
import sys

def show():
    """Displays the game directly inside a Google Colab / Jupyter notebook cell."""
    try:
        from IPython.display import HTML, display
        standalone_path = '/content/bunker_survival_standalone.html'
        if not os.path.exists(standalone_path):
            from bunker_survival.build_standalone import main as build
            build()
        with open(standalone_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Render responsive iframe
        html_code = f"""
        <div style="width: 100%; max-width: 1300px; height: 860px; border: 2px solid #2d3748; border-radius: 8px; overflow: hidden; background: #0f1115;">
          <iframe srcdoc="{content.replace('"', '&quot;')}" style="width:100%; height:100%; border:none;" allow="autoplay"></iframe>
        </div>
        """
        display(HTML(html_code))
        print("🛡️ Game loaded inside notebook!")
    except Exception as e:
        print(f"Note: To play in browser, run: python3 /content/bunker_survival/server.py")
        print(f"Error displaying in cell: {e}")

if __name__ == '__main__':
    # Launch server
    from bunker_survival.server import PORT, Handler
    import socketserver
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    with socketserver.TCPServer(("", port), Handler) as httpd:
        print(f"==================================================")
        print(f"  🛡️ BUNKER PROTOCOL: 2D Zombie Survival Defense")
        print(f"  Game Server running at: http://localhost:{port}")
        print(f"  Direct playable HTML: /content/bunker_survival_standalone.html")
        print(f"==================================================")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down.")
