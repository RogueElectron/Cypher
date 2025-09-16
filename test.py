
#tests if opaque is working nicely
try:
    import opaque; print(opaque.__doc__)
except Exception as e:
    print("you have a problem with the deps, refer back to the .sh", e)
    