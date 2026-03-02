using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Web;
using System.Web.Http;

namespace WebSite.Api
{
    public class BooksApiController : ApiController
    {
        private string BasePath
        {
            get
            {
                return HttpContext.Current.Server.MapPath("~/Uploads/Audio/ABOOKS");
            }
        }

        // GET: api/BooksApi/GetBooks
        [HttpGet]
        public IHttpActionResult GetBooks()
        {
            try
            {
                if (!Directory.Exists(BasePath))
                    return NotFound();

                var bookFolders = new List<string>();
                ScanFolders(BasePath, bookFolders);

                var result = bookFolders.Select(folder => new
                {
                    // full relative path
                    name = folder,
                    filesUrl = $"https://slava.localto.net/api/BooksApi/GetBookFiles?book={Uri.EscapeDataString(folder)}"
                });

                return Ok(result);
            }
            catch (Exception ex)
            {
                return InternalServerError(ex);
            }
        }

        // Recursive folder scanner — returns FULL RELATIVE PATHS
        private void ScanFolders(string folder, List<string> result)
        {
            // Detect MP3 or image files
            var mp3Files = Directory.GetFiles(folder, "*.mp3");
            var imageFiles = Directory.GetFiles(folder)
                .Where(f => f.EndsWith(".jpg", StringComparison.OrdinalIgnoreCase)
                         || f.EndsWith(".jpeg", StringComparison.OrdinalIgnoreCase)
                         || f.EndsWith(".png", StringComparison.OrdinalIgnoreCase))
                .ToArray();

            // If folder contains MP3 or images → treat as a book folder
            if (mp3Files.Length > 0 || imageFiles.Length > 0)
            {
                var relative = folder.Substring(BasePath.Length).TrimStart('\\');
                relative = relative.Replace("\\", "/");

                if (!result.Contains(relative))
                    result.Add(relative);
                // IMPORTANT: do NOT return — keep scanning subfolders
            }

            // Always scan subfolders
 
            foreach (var sub in Directory.GetDirectories(folder))
            {
                var name = Path.GetFileName(sub);
                if (name.StartsWith("copy", StringComparison.OrdinalIgnoreCase))
                    continue;

                ScanFolders(sub, result);
            }

        }


        // GET: api/BooksApi/GetBookFiles?book=<relative path>
        [HttpGet]
        public IHttpActionResult GetBookFiles(string book)
        {
            try
            {
                if (string.IsNullOrEmpty(book))
                    return BadRequest("Missing book parameter.");

                // Combine base path + relative path
                var folder = Path.Combine(BasePath, book.Replace("/", "\\"));

                if (!Directory.Exists(folder))
                    return NotFound();

                var files = Directory.GetFiles(folder, "*.mp3")
                    .Select(Path.GetFileName)
                    .ToList();

                return Ok(files);
            }
            catch (Exception ex)
            {
                return InternalServerError(ex);
            }
        }

        // GET: api/BooksApi/GetBookCover?book=<relative path>
        [HttpGet]
        public IHttpActionResult GetBookCover(string book)
        {
            try
            {
                if (string.IsNullOrEmpty(book))
                    return BadRequest("Missing book parameter.");

                var folder = Path.Combine(BasePath, book.Replace("/", "\\"));

                if (!Directory.Exists(folder))
                    return Ok<string>(null);

                var image = Directory.GetFiles(folder)
                    .FirstOrDefault(f =>
                        f.EndsWith(".jpg", StringComparison.OrdinalIgnoreCase) ||
                        f.EndsWith(".jpeg", StringComparison.OrdinalIgnoreCase) ||
                        f.EndsWith(".png", StringComparison.OrdinalIgnoreCase));

                if (image == null)
                    return Ok<string>(null);

                var relative = image.Substring(BasePath.Length).TrimStart('\\');
                relative = relative.Replace("\\", "/");

                return Ok(relative);
            }
            catch (Exception ex)
            {
                return InternalServerError(ex);
            }
        }

        // ---------------- USER PROGRESS SYSTEM ----------------

        public class UserProgressModel
        {
            public string userId { get; set; }
            public string email { get; set; }

            // book → { file, position, updated }
            public Dictionary<string, BookProgress> books { get; set; }
        }

        public class BookProgress
        {
            public string file { get; set; }
            public double position { get; set; }
            public DateTime updated { get; set; }
        }

        // Path to user JSON files
        private string UserDataPath =>
            HttpContext.Current.Server.MapPath("~/App_Data/ab_pwa");

        // Ensure folder exists
        private void EnsureUserFolder()
        {
            if (!Directory.Exists(UserDataPath))
                Directory.CreateDirectory(UserDataPath);
        }

        // Get full path to user file
        private string GetUserFile(string userId)
        {
            return Path.Combine(UserDataPath, $"{userId}.json");
        }

        // Load user file or create new
        private UserProgressModel LoadUser(string userId)
        {
            EnsureUserFolder();
            var file = GetUserFile(userId);

            if (!File.Exists(file))
                return null;

            var json = File.ReadAllText(file);
            return Newtonsoft.Json.JsonConvert.DeserializeObject<UserProgressModel>(json);
        }

        // Save user file
        private void SaveUser(UserProgressModel user)
        {
            EnsureUserFolder();

            // --- LIMIT TO LAST 10 BOOKS (sorted by updated DESC) ---
            if (user.books != null && user.books.Count > 10)
            {
                user.books = user.books
                    .OrderByDescending(kvp => kvp.Value.updated)
                    .Take(10)
                    .ToDictionary(kvp => kvp.Key, kvp => kvp.Value);
            }

            var file = GetUserFile(user.userId);
            var json = Newtonsoft.Json.JsonConvert.SerializeObject(
                user,
                Newtonsoft.Json.Formatting.Indented
            );

            File.WriteAllText(file, json);
        }



        // ---------------- API METHODS ----------------

        // POST api/BooksApi/Login
        [HttpPost]
        public IHttpActionResult Login([FromBody] dynamic body)
        {
            try
            {
                string email = body.email;
                if (string.IsNullOrEmpty(email))
                    return BadRequest("Email required.");

                EnsureUserFolder();

                // Try to find existing user
                var existing = Directory.GetFiles(UserDataPath, "*.json");
                foreach (var file in existing)
                {
                    var json = File.ReadAllText(file);
                    var user = Newtonsoft.Json.JsonConvert.DeserializeObject<UserProgressModel>(json);
                    if (user.email.Equals(email, StringComparison.OrdinalIgnoreCase))
                    {
                        return Ok(new { userId = user.userId });
                    }
                }

                // Create new user
                var newUser = new UserProgressModel
                {
                    userId = Guid.NewGuid().ToString("N"),
                    email = email,
                    books = new Dictionary<string, BookProgress>()
                };

                SaveUser(newUser);

                return Ok(new { userId = newUser.userId });
            }
            catch (Exception ex)
            {
                return InternalServerError(ex);
            }
        }


        // GET api/BooksApi/GetProgress?userId=xxxx
        [HttpGet]
        public IHttpActionResult GetProgress(string userId)
        {
            try
            {
                if (string.IsNullOrEmpty(userId))
                    return BadRequest("Missing userId.");

                var user = LoadUser(userId);
                if (user == null)
                    return NotFound();

                return Ok(user);
            }
            catch (Exception ex)
            {
                return InternalServerError(ex);
            }
        }


        // POST api/BooksApi/SaveProgress
        [HttpPost]
        public IHttpActionResult SaveProgress([FromBody] dynamic body)
        {
            try
            {
                string userId = body.userId;
                string book = body.book;
                string file = body.file;
                double position = body.position;

                if (string.IsNullOrEmpty(userId) || string.IsNullOrEmpty(book))
                    return BadRequest("Missing parameters.");

                var user = LoadUser(userId);
                if (user == null)
                    return NotFound();

                if (user.books == null)
                    user.books = new Dictionary<string, BookProgress>();

                user.books[book] = new BookProgress
                {
                    file = file,
                    position = position,
                    updated = DateTime.UtcNow
                };

                SaveUser(user);

                return Ok(new { status = "saved" });
            }
            catch (Exception ex)
            {
                return InternalServerError(ex);
            }
        }
        [HttpOptions]
        public IHttpActionResult Options(string id = null)
        {
            return Ok();
        }

    }
}
